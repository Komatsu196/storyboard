import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { json } from "./test/authed";
import { createFixture } from "./test/fixture";

const app = createApp();

describe("scene order", () => {
	it("reorders the scenes without touching their numbers", async () => {
		const { req, project, s1, s2, detail } = await createFixture(app);
		const res = await req(
			`/api/projects/${project.id}/scenes/order`,
			json("PUT", { ids: [s2.id, s1.id] }),
		);
		expect(res.status).toBe(204);
		const scenes = (await detail()).scenes;
		expect(scenes.map((s) => [s.id, s.position, s.number])).toEqual([
			[s2.id, 0, "2"],
			[s1.id, 1, "1"],
		]);
	});

	it("rejects missing, extra, duplicated or foreign ids", async () => {
		const { req, project, s1, s2, c1 } = await createFixture(app);
		const path = `/api/projects/${project.id}/scenes/order`;
		for (const ids of [
			[s1.id],
			[s1.id, s2.id, c1.id],
			[s1.id, s1.id],
			[s1.id, "other"],
		]) {
			const res = await req(path, json("PUT", { ids }));
			expect(res.status).toBe(400);
			expect(await res.json()).toMatchObject({ error: "validation" });
		}
	});

	it("returns 404 for an unknown project", async () => {
		const { req } = await createFixture(app);
		const res = await req(
			"/api/projects/nope/scenes/order",
			json("PUT", { ids: [] }),
		);
		expect(res.status).toBe(404);
	});
});

describe("shot order", () => {
	it("reorders the shots of a scene without touching their numbers", async () => {
		const { req, s1, c1, c2, detail } = await createFixture(app);
		const res = await req(
			`/api/scenes/${s1.id}/shots/order`,
			json("PUT", { ids: [c2.id, c1.id] }),
		);
		expect(res.status).toBe(204);
		const shots = (await detail()).scenes[0].shots;
		expect(shots.map((s) => [s.id, s.position, s.number])).toEqual([
			[c2.id, 0, "2"],
			[c1.id, 1, "1"],
		]);
	});

	it("accepts an empty list for a scene without shots", async () => {
		const { req, s2 } = await createFixture(app);
		const res = await req(
			`/api/scenes/${s2.id}/shots/order`,
			json("PUT", { ids: [] }),
		);
		expect(res.status).toBe(204);
	});

	it("rejects a shot from another scene", async () => {
		const { req, s2, c1 } = await createFixture(app);
		const res = await req(
			`/api/scenes/${s2.id}/shots/order`,
			json("PUT", { ids: [c1.id] }),
		);
		expect(res.status).toBe(400);
	});

	it("returns 404 for an unknown scene", async () => {
		const { req } = await createFixture(app);
		const res = await req(
			"/api/scenes/nope/shots/order",
			json("PUT", { ids: [] }),
		);
		expect(res.status).toBe(404);
	});
});
