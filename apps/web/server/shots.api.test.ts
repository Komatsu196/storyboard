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

	it("returns 404 for an unknown shot", async () => {
		const { req } = await setup();
		const res = await req("/api/shots/nope/sketch", json("PUT", sketch));
		expect(res.status).toBe(404);
	});
});
