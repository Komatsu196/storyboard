import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { authed, json } from "./test/authed";

const app = createApp();

describe("projects", () => {
	it("requires a session", async () => {
		const res = await app.request("/api/projects", {}, env);
		expect(res.status).toBe(401);
	});

	it("creates a project with the default aspect ratio and lists newest first", async () => {
		const req = await authed(app);
		const a = await req("/api/projects", json("POST", { title: "A" }));
		expect(a.status).toBe(201);
		const projectA = (await a.json()) as {
			id: string;
			createdAt: string;
			updatedAt: string;
		};
		expect(projectA).toMatchObject({ title: "A", aspectRatio: "16:9" });
		expect(projectA.id).toEqual(expect.any(String));
		expect(projectA.createdAt).toEqual(projectA.updatedAt);

		await new Promise((r) => setTimeout(r, 2)); // createdAt を確実にずらす
		const b = await req(
			"/api/projects",
			json("POST", { title: "B", aspectRatio: "9:16" }),
		);
		expect(b.status).toBe(201);
		expect(await b.json()).toMatchObject({ title: "B", aspectRatio: "9:16" });

		const list = await req("/api/projects");
		expect(list.status).toBe(200);
		const titles = ((await list.json()) as { title: string }[]).map(
			(p: { title: string }) => p.title,
		);
		expect(titles).toEqual(["B", "A"]);
	});

	it("rejects a blank title or an unknown aspect ratio", async () => {
		const req = await authed(app);
		const blank = await req("/api/projects", json("POST", { title: "  " }));
		expect(blank.status).toBe(400);
		expect(await blank.json()).toMatchObject({ error: "validation" });
		const ratio = await req(
			"/api/projects",
			json("POST", { title: "x", aspectRatio: "1:1" }),
		);
		expect(ratio.status).toBe(400);
	});

	it("returns 404 for an unknown project", async () => {
		const req = await authed(app);
		const res = await req("/api/projects/nope");
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: "not_found" });
	});

	it("adds scenes with sequential numbers and returns them in the detail", async () => {
		const req = await authed(app);
		const project = (await (
			await req("/api/projects", json("POST", { title: "P" }))
		).json()) as { id: string };

		const s1 = await req(
			`/api/projects/${project.id}/scenes`,
			json("POST", {}),
		);
		expect(s1.status).toBe(201);
		expect(await s1.json()).toMatchObject({
			projectId: project.id,
			position: 0,
			number: "1",
			title: "",
		});
		const s2 = await req(
			`/api/projects/${project.id}/scenes`,
			json("POST", { title: "夜" }),
		);
		expect(await s2.json()).toMatchObject({
			position: 1,
			number: "2",
			title: "夜",
		});

		const detail = await req(`/api/projects/${project.id}`);
		expect(detail.status).toBe(200);
		const body = (await detail.json()) as {
			scenes: { number: string; shots: unknown[] }[];
		};
		expect(body).toMatchObject({
			id: project.id,
			title: "P",
			aspectRatio: "16:9",
		});
		expect(
			body.scenes.map((s: { number: string; shots: unknown[] }) => [
				s.number,
				s.shots,
			]),
		).toEqual([
			["1", []],
			["2", []],
		]);
	});

	it("returns 404 when adding a scene to an unknown project", async () => {
		const req = await authed(app);
		const res = await req("/api/projects/nope/scenes", json("POST", {}));
		expect(res.status).toBe(404);
	});
});
