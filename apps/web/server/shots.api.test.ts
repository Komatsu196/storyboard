import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { authed, json } from "./test/authed";

const app = createApp();

async function setup() {
	const req = await authed(app);
	const project = (await (
		await req("/api/projects", json("POST", { title: "P" }))
	).json()) as { id: string };
	const scene = (await (
		await req(`/api/projects/${project.id}/scenes`, json("POST", {}))
	).json()) as { id: string };
	return { req, project, scene };
}

const sketch = {
	v: 1,
	w: 1600,
	h: 900,
	strokes: [{ color: "black", size: 2, p: [10, 10, 50, 60] }],
};

describe("shots", () => {
	it("requires a session", async () => {
		const res = await app.request(
			"/api/scenes/x/shots",
			{ method: "POST" },
			env,
		);
		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ error: "unauthorized" });
	});

	it("creates shots with sequential numbers and no sketch", async () => {
		const { req, scene } = await setup();
		const c1 = await req(`/api/scenes/${scene.id}/shots`, { method: "POST" });
		expect(c1.status).toBe(201);
		expect(await c1.json()).toMatchObject({
			sceneId: scene.id,
			position: 0,
			number: "1",
			shotSize: null,
			cameraMove: "",
			action: "",
			dialogue: "",
			durationSec: null,
			notes: "",
			sketch: null,
		});
		const c2 = await (
			await req(`/api/scenes/${scene.id}/shots`, { method: "POST" })
		).json();
		expect(c2).toMatchObject({ position: 1, number: "2" });
	});

	it("returns 404 for an unknown scene", async () => {
		const { req } = await setup();
		const res = await req("/api/scenes/nope/shots", { method: "POST" });
		expect(res.status).toBe(404);
	});
});

describe("sketches", () => {
	it("requires a session", async () => {
		const res = await app.request(
			"/api/shots/x/sketch",
			json("PUT", sketch),
			env,
		);
		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ error: "unauthorized" });
	});

	it("upserts a sketch and returns it in the project detail", async () => {
		const { req, project, scene } = await setup();
		const shot = (await (
			await req(`/api/scenes/${scene.id}/shots`, { method: "POST" })
		).json()) as { id: string };

		const first = await req(
			`/api/shots/${shot.id}/sketch`,
			json("PUT", sketch),
		);
		expect(first.status).toBe(204);

		const updated = {
			...sketch,
			strokes: [...sketch.strokes, { color: "red", size: 3, p: [0, 0] }],
		};
		const second = await req(
			`/api/shots/${shot.id}/sketch`,
			json("PUT", updated),
		);
		expect(second.status).toBe(204);

		const detail = (await (
			await req(`/api/projects/${project.id}`)
		).json()) as {
			scenes: { shots: { sketch: unknown }[] }[];
		};
		expect(detail.scenes[0].shots[0].sketch).toEqual(updated);
	});

	it("rejects an invalid sketch", async () => {
		const { req, scene } = await setup();
		const shot = (await (
			await req(`/api/scenes/${scene.id}/shots`, { method: "POST" })
		).json()) as { id: string };
		const odd = {
			...sketch,
			strokes: [{ color: "black", size: 2, p: [1, 2, 3] }],
		};
		expect(
			(await req(`/api/shots/${shot.id}/sketch`, json("PUT", odd))).status,
		).toBe(400);
		const tooMany = {
			...sketch,
			strokes: Array.from({ length: 2001 }, () => sketch.strokes[0]),
		};
		expect(
			(await req(`/api/shots/${shot.id}/sketch`, json("PUT", tooMany))).status,
		).toBe(400);
	});

	it("rejects a body over 1 MB with 413", async () => {
		const { req, scene } = await setup();
		const shot = (await (
			await req(`/api/scenes/${scene.id}/shots`, { method: "POST" })
		).json()) as { id: string };
		const big = {
			...sketch,
			strokes: Array.from({ length: 1500 }, () => ({
				color: "black" as const,
				size: 2 as const,
				p: Array.from({ length: 200 }, (_, i) => i),
			})),
		};
		expect(JSON.stringify(big).length).toBeGreaterThan(1024 * 1024);
		const res = await req(`/api/shots/${shot.id}/sketch`, json("PUT", big));
		expect(res.status).toBe(413);
		expect(await res.json()).toEqual({ error: "too_large" });
	});

	it("returns 404 for an unknown shot", async () => {
		const { req } = await setup();
		const res = await req("/api/shots/nope/sketch", json("PUT", sketch));
		expect(res.status).toBe(404);
	});
});

describe("patch shot", () => {
	async function setupShot() {
		const ctx = await setup();
		const shot = (await (
			await ctx.req(`/api/scenes/${ctx.scene.id}/shots`, { method: "POST" })
		).json()) as { id: string; createdAt: string; updatedAt: string };
		return { ...ctx, shot };
	}

	it("requires a session", async () => {
		const res = await app.request(
			"/api/shots/x",
			json("PATCH", { number: "1" }),
			env,
		);
		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ error: "unauthorized" });
	});

	it("updates the sent fields, keeps the rest and advances updatedAt", async () => {
		const { req, project, scene, shot } = await setupShot();
		const res = await req(
			`/api/shots/${shot.id}`,
			json("PATCH", {
				number: " 2A ",
				shotSize: "MS",
				cameraMove: "Pan",
				action: "A が振り返る",
				dialogue: "A：おはよう",
				durationSec: 2.5,
				notes: "三脚",
			}),
		);
		expect(res.status).toBe(200);
		const row = (await res.json()) as Record<string, unknown>;
		expect(row).toMatchObject({
			id: shot.id,
			sceneId: scene.id,
			position: 0,
			number: "2A",
			shotSize: "MS",
			cameraMove: "Pan",
			action: "A が振り返る",
			dialogue: "A：おはよう",
			durationSec: 2.5,
			notes: "三脚",
			createdAt: shot.createdAt,
		});
		expect(row).not.toHaveProperty("sketch");
		expect(Date.parse(row.updatedAt as string)).toBeGreaterThanOrEqual(
			Date.parse(shot.updatedAt),
		);

		// 部分更新: 送った項目だけ変わり、他は残る
		const partial = await req(
			`/api/shots/${shot.id}`,
			json("PATCH", { shotSize: null, notes: "" }),
		);
		expect(partial.status).toBe(200);
		expect(await partial.json()).toMatchObject({
			number: "2A",
			shotSize: null,
			cameraMove: "Pan",
			action: "A が振り返る",
			durationSec: 2.5,
			notes: "",
		});

		// 作品の取得に反映される
		const detail = (await (
			await req(`/api/projects/${project.id}`)
		).json()) as { scenes: { shots: Record<string, unknown>[] }[] };
		expect(detail.scenes[0].shots[0]).toMatchObject({
			number: "2A",
			shotSize: null,
			cameraMove: "Pan",
			durationSec: 2.5,
		});
	});

	it("accepts an empty body", async () => {
		const { req, shot } = await setupShot();
		const res = await req(`/api/shots/${shot.id}`, json("PATCH", {}));
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ id: shot.id, number: "1" });
	});

	it("rejects invalid fields with 400", async () => {
		const { req, shot } = await setupShot();
		for (const body of [
			{ number: "   " },
			{ shotSize: "XL" },
			{ durationSec: -1 },
			{ notes: "x".repeat(2001) },
		]) {
			const res = await req(`/api/shots/${shot.id}`, json("PATCH", body));
			expect(res.status).toBe(400);
			expect(await res.json()).toMatchObject({ error: "validation" });
		}
	});

	it("returns 404 for an unknown shot", async () => {
		const { req } = await setup();
		const res = await req("/api/shots/nope", json("PATCH", { number: "1" }));
		expect(res.status).toBe(404);
	});
});
