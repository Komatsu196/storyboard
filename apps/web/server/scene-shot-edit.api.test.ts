import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { json } from "./test/authed";
import { createFixture } from "./test/fixture";

const app = createApp();

const count = async (table: "scenes" | "shots" | "sketches") =>
	(
		await env.DB.prepare(`select count(*) as n from ${table}`).first<{
			n: number;
		}>()
	)?.n;

describe("patch scene", () => {
	it("updates the number and the title (trimmed)", async () => {
		const { req, s1, detail } = await createFixture(app);
		const res = await req(
			`/api/scenes/${s1.id}`,
			json("PATCH", { number: " 2A ", title: " 夜の公園 " }),
		);
		expect(res.status).toBe(200);
		const row = await res.json();
		expect(row).toMatchObject({ id: s1.id, number: "2A", title: "夜の公園" });
		expect(row).not.toHaveProperty("shots");
		expect((await detail()).scenes[0]).toMatchObject({
			number: "2A",
			title: "夜の公園",
		});
	});

	it("keeps the other field on a partial update and accepts {}", async () => {
		const { req, s1 } = await createFixture(app);
		await req(`/api/scenes/${s1.id}`, json("PATCH", { title: "朝" }));
		const partial = await req(
			`/api/scenes/${s1.id}`,
			json("PATCH", { number: "5" }),
		);
		expect(await partial.json()).toMatchObject({ number: "5", title: "朝" });
		const empty = await req(`/api/scenes/${s1.id}`, json("PATCH", {}));
		expect(empty.status).toBe(200);
		expect(await empty.json()).toMatchObject({ number: "5", title: "朝" });
	});

	it("rejects a blank number", async () => {
		const { req, s1 } = await createFixture(app);
		const res = await req(
			`/api/scenes/${s1.id}`,
			json("PATCH", { number: "" }),
		);
		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ error: "validation" });
	});

	it("returns 404 for an unknown scene", async () => {
		const { req } = await createFixture(app);
		const res = await req("/api/scenes/nope", json("PATCH", { title: "a" }));
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: "not_found" });
	});
});

describe("delete scene", () => {
	it("deletes the scene with its shots and sketches, keeping the other scene", async () => {
		const { req, s1, s2, c1, putSketch, detail } = await createFixture(app);
		await putSketch(c1.id, [1, 1]);
		const res = await req(`/api/scenes/${s1.id}`, { method: "DELETE" });
		expect(res.status).toBe(204);
		expect((await detail()).scenes.map((s) => s.id)).toEqual([s2.id]);
		expect(await count("scenes")).toBe(1);
		expect(await count("shots")).toBe(0);
		expect(await count("sketches")).toBe(0);
	});

	it("returns 404 for an unknown scene", async () => {
		const { req } = await createFixture(app);
		const res = await req("/api/scenes/nope", { method: "DELETE" });
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: "not_found" });
	});
});

describe("delete shot", () => {
	it("deletes the shot with its sketch, keeping the other shot", async () => {
		const { req, c1, c2, putSketch, detail } = await createFixture(app);
		await putSketch(c1.id, [1, 1]);
		const res = await req(`/api/shots/${c1.id}`, { method: "DELETE" });
		expect(res.status).toBe(204);
		expect((await detail()).scenes[0].shots.map((s) => s.id)).toEqual([c2.id]);
		expect(await count("sketches")).toBe(0);
	});

	it("returns 404 for an unknown shot", async () => {
		const { req } = await createFixture(app);
		const res = await req("/api/shots/nope", { method: "DELETE" });
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: "not_found" });
	});
});
