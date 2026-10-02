import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { json } from "./test/authed";
import { createFixture } from "./test/fixture";

const app = createApp();

const fields = {
	shotSize: "CU",
	cameraMove: "Pan",
	action: "走る",
	dialogue: "待って",
	durationSec: 2.5,
	notes: "雨",
};

describe("duplicate shot", () => {
	it("inserts a copy of the fields and the sketch right after the source", async () => {
		const { req, s1, c1, c2, detail, putSketch } = await createFixture(app);
		await req(`/api/shots/${c1.id}`, json("PATCH", fields));
		await putSketch(c1.id, [1, 2, 3, 4]);

		const res = await req(`/api/shots/${c1.id}/duplicate`, { method: "POST" });
		expect(res.status).toBe(201);
		const copy = (await res.json()) as { id: string };
		expect(copy).toMatchObject({
			sceneId: s1.id,
			number: "1-2",
			...fields,
			sketch: { w: 1600, h: 900, strokes: [{ p: [1, 2, 3, 4] }] },
		});
		expect(copy.id).not.toBe(c1.id);

		const shots = (await detail()).scenes[0]?.shots ?? [];
		expect(shots.map((s) => s.id)).toEqual([c1.id, copy.id, c2.id]);
		expect(shots.map((s) => s.number)).toEqual(["1", "1-2", "2"]);
		expect(shots[1]).toMatchObject({
			...fields,
			sketch: { strokes: [{ p: [1, 2, 3, 4] }] },
		});
	});

	it("copies a shot without a sketch as one without a sketch", async () => {
		const { req, c2, detail } = await createFixture(app);
		const res = await req(`/api/shots/${c2.id}/duplicate`, { method: "POST" });
		expect(await res.json()).toMatchObject({ number: "2-2", sketch: null });
		const shots = (await detail()).scenes[0]?.shots ?? [];
		expect(shots.map((s) => s.number)).toEqual(["1", "2", "2-2"]);
		expect(shots[2]?.sketch).toBeNull();
	});

	it("picks the next free number when duplicating again", async () => {
		const { req, c1, detail } = await createFixture(app);
		await req(`/api/shots/${c1.id}/duplicate`, { method: "POST" });
		await req(`/api/shots/${c1.id}/duplicate`, { method: "POST" });
		const shots = (await detail()).scenes[0]?.shots ?? [];
		expect(shots.map((s) => s.number)).toEqual(["1", "1-3", "1-2", "2"]);
	});

	it("does not move the shots of other scenes", async () => {
		const { req, s2, c1, detail } = await createFixture(app);
		const other = (await (
			await req(`/api/scenes/${s2.id}/shots`, json("POST", {}))
		).json()) as { id: string; position: number };
		await req(`/api/shots/${c1.id}/duplicate`, { method: "POST" });
		const shot = (await detail()).scenes[1]?.shots[0];
		expect(shot).toMatchObject({ id: other.id, position: other.position });
	});

	it("returns 404 for an unknown shot", async () => {
		const { req } = await createFixture(app);
		const res = await req("/api/shots/nope/duplicate", { method: "POST" });
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: "not_found" });
	});
});

describe("duplicate scene", () => {
	it("inserts a copy of the title and all shots right after the source", async () => {
		const { req, project, s1, s2, c1, c2, detail, putSketch } =
			await createFixture(app);
		await req(`/api/scenes/${s1.id}`, json("PATCH", { title: "夜の公園" }));
		await req(`/api/shots/${c1.id}`, json("PATCH", fields));
		await putSketch(c1.id, [5, 6, 7, 8]);

		const res = await req(`/api/scenes/${s1.id}/duplicate`, {
			method: "POST",
		});
		expect(res.status).toBe(201);
		const copy = (await res.json()) as {
			id: string;
			shots: { id: string }[];
		};
		expect(copy).toMatchObject({
			projectId: project.id,
			number: "1-2",
			title: "夜の公園",
			shots: [
				{
					number: "1",
					...fields,
					sketch: { strokes: [{ p: [5, 6, 7, 8] }] },
				},
				{ number: "2", sketch: null },
			],
		});
		const copiedIds = copy.shots.map((s) => s.id);
		expect(copiedIds).not.toContain(c1.id);
		expect(copiedIds).not.toContain(c2.id);
		expect(
			copy.shots.every((s) => (s as { sceneId?: string }).sceneId === copy.id),
		).toBe(true);

		const scenes = (await detail()).scenes;
		expect(scenes.map((s) => s.id)).toEqual([s1.id, copy.id, s2.id]);
		expect(scenes.map((s) => s.number)).toEqual(["1", "1-2", "2"]);
		// 元のシーンはそのまま
		expect(scenes[0]?.shots.map((s) => s.id)).toEqual([c1.id, c2.id]);
		expect(scenes[1]).toMatchObject({
			title: "夜の公園",
			shots: [
				{
					id: copiedIds[0],
					number: "1",
					...fields,
					sketch: { strokes: [{ p: [5, 6, 7, 8] }] },
				},
				{ id: copiedIds[1], number: "2", sketch: null },
			],
		});
	});

	it("copies an empty scene", async () => {
		const { req, s2, detail } = await createFixture(app);
		const res = await req(`/api/scenes/${s2.id}/duplicate`, {
			method: "POST",
		});
		expect(await res.json()).toMatchObject({ number: "2-2", shots: [] });
		const scenes = (await detail()).scenes;
		expect(scenes.map((s) => s.number)).toEqual(["1", "2", "2-2"]);
	});

	it("does not move the scenes of other projects", async () => {
		const { req, s1 } = await createFixture(app);
		const other = await createFixture(app);
		await req(`/api/scenes/${s1.id}/duplicate`, { method: "POST" });
		const scenes = (await other.detail()).scenes;
		expect(scenes.map((s) => [s.id, s.position])).toEqual([
			[other.s1.id, 0],
			[other.s2.id, 1],
		]);
	});

	it("returns 404 for an unknown scene", async () => {
		const { req } = await createFixture(app);
		const res = await req("/api/scenes/nope/duplicate", { method: "POST" });
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: "not_found" });
	});
});
