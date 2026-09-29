import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { json } from "./test/authed";
import { createFixture } from "./test/fixture";

const app = createApp();

const count = async (table: "projects" | "scenes" | "shots" | "sketches") =>
	(
		await env.DB.prepare(`select count(*) as n from ${table}`).first<{
			n: number;
		}>()
	)?.n;

const sketchUpdatedAt = (shotId: string) =>
	env.DB.prepare("select updated_at from sketches where shot_id = ?")
		.bind(shotId)
		.first<string>("updated_at");

describe("patch project", () => {
	it("requires a session", async () => {
		const res = await app.request(
			"/api/projects/x",
			json("PATCH", { title: "a" }),
			env,
		);
		expect(res.status).toBe(401);
	});

	it("renames the project and advances updatedAt", async () => {
		const { req, project, detail } = await createFixture(app);
		const before = await detail();
		await new Promise((r) => setTimeout(r, 2));
		const res = await req(
			`/api/projects/${project.id}`,
			json("PATCH", { title: "  New  " }),
		);
		expect(res.status).toBe(200);
		const row = (await res.json()) as { title: string; updatedAt: string };
		expect(row).toMatchObject({
			id: project.id,
			title: "New",
			aspectRatio: "16:9",
		});
		expect(row.updatedAt > before.updatedAt).toBe(true);
		expect((await detail()).title).toBe("New");
	});

	it("recenters every sketch of the project when the aspect ratio changes, and back", async () => {
		const { req, project, c1, c2, detail, putSketch } =
			await createFixture(app);
		expect((await putSketch(c1.id, [800, 450, 810, 460])).status).toBe(204);
		expect((await putSketch(c2.id, [0, 0])).status).toBe(204);

		const res = await req(
			`/api/projects/${project.id}`,
			json("PATCH", { aspectRatio: "9:16" }),
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ aspectRatio: "9:16" });

		const shots = (await detail()).scenes[0].shots;
		expect(shots[0].sketch).toMatchObject({ w: 900, h: 1600 });
		expect(shots[0].sketch?.strokes[0].p).toEqual([450, 800, 460, 810]);
		expect(shots[1].sketch?.strokes[0].p).toEqual([-350, 350]);

		await req(
			`/api/projects/${project.id}`,
			json("PATCH", { aspectRatio: "16:9" }),
		);
		const back = (await detail()).scenes[0].shots;
		expect(back[0].sketch).toMatchObject({ w: 1600, h: 900 });
		expect(back[0].sketch?.strokes[0].p).toEqual([800, 450, 810, 460]);
		expect(back[1].sketch?.strokes[0].p).toEqual([0, 0]);
	});

	it("does not rewrite sketches when the aspect ratio stays the same", async () => {
		const { req, project, c1, putSketch } = await createFixture(app);
		await putSketch(c1.id, [800, 450]);
		const before = await sketchUpdatedAt(c1.id);
		await new Promise((r) => setTimeout(r, 2));
		const res = await req(
			`/api/projects/${project.id}`,
			json("PATCH", { title: "Same", aspectRatio: "16:9" }),
		);
		expect(res.status).toBe(200);
		expect(await sketchUpdatedAt(c1.id)).toBe(before);
	});

	it("heals sketches left in another frame even when the ratio does not change", async () => {
		const { req, project, c1, detail, putSketch } = await createFixture(
			app,
			"16:9",
		);
		expect(
			(await putSketch(c1.id, [450, 800], { w: 900, h: 1600 })).status,
		).toBe(204);

		const res = await req(
			`/api/projects/${project.id}`,
			json("PATCH", { aspectRatio: "16:9" }),
		);
		expect(res.status).toBe(200);

		const shot = (await detail()).scenes[0].shots[0];
		expect(shot.sketch).toMatchObject({ w: 1600, h: 900 });
		expect(shot.sketch?.strokes[0].p).toEqual([800, 450]);
	});

	it("leaves the sketches of other projects alone", async () => {
		const a = await createFixture(app);
		const b = await createFixture(app);
		await b.putSketch(b.c1.id, [800, 450]);
		await a.req(
			`/api/projects/${a.project.id}`,
			json("PATCH", { aspectRatio: "4:3" }),
		);
		const shot = (await b.detail()).scenes[0].shots[0];
		expect(shot.sketch).toMatchObject({ w: 1600, h: 900 });
		expect(shot.sketch?.strokes[0].p).toEqual([800, 450]);
	});

	it("rejects a blank title or an unknown aspect ratio", async () => {
		const { req, project } = await createFixture(app);
		const blank = await req(
			`/api/projects/${project.id}`,
			json("PATCH", { title: " " }),
		);
		expect(blank.status).toBe(400);
		expect(await blank.json()).toMatchObject({ error: "validation" });
		const ratio = await req(
			`/api/projects/${project.id}`,
			json("PATCH", { aspectRatio: "1:1" }),
		);
		expect(ratio.status).toBe(400);
	});

	it("returns 404 for an unknown project", async () => {
		const { req } = await createFixture(app);
		const res = await req("/api/projects/nope", json("PATCH", { title: "a" }));
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: "not_found" });
	});
});

describe("delete project", () => {
	it("deletes the project with its scenes, shots and sketches (cascade)", async () => {
		const { req, project, c1, putSketch } = await createFixture(app);
		await putSketch(c1.id, [1, 1]);
		const res = await req(`/api/projects/${project.id}`, { method: "DELETE" });
		expect(res.status).toBe(204);
		expect((await req(`/api/projects/${project.id}`)).status).toBe(404);
		expect(await count("projects")).toBe(0);
		expect(await count("scenes")).toBe(0);
		expect(await count("shots")).toBe(0);
		expect(await count("sketches")).toBe(0);
	});

	it("keeps the other projects", async () => {
		const a = await createFixture(app);
		const b = await createFixture(app);
		await a.req(`/api/projects/${a.project.id}`, { method: "DELETE" });
		expect((await b.detail()).scenes).toHaveLength(2);
		expect(await count("projects")).toBe(1);
	});

	it("returns 404 for an unknown project", async () => {
		const { req } = await createFixture(app);
		const res = await req("/api/projects/nope", { method: "DELETE" });
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: "not_found" });
	});
});
