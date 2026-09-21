import { zValidator } from "@hono/zod-validator";
import { desc, eq, getTableColumns } from "drizzle-orm";
import { Hono } from "hono";
import { createProjectSchema, createSceneSchema } from "../../shared/schemas";
import type { SketchData } from "../../shared/sketch/types";
import { createDb } from "../db";
import { projects, scenes, shots, sketches } from "../db/schema";
import { nextNumber, nextPosition } from "../numbering";
import { validationHook } from "../validate";

export const projectRoutes = new Hono<{ Bindings: Env }>()
	.get("/", async (c) => {
		const rows = await createDb(c.env.DB)
			.select()
			.from(projects)
			.orderBy(desc(projects.createdAt));
		return c.json(rows);
	})
	.post(
		"/",
		zValidator("json", createProjectSchema, validationHook),
		async (c) => {
			const input = c.req.valid("json");
			const now = new Date().toISOString();
			const row: typeof projects.$inferSelect = {
				id: crypto.randomUUID(),
				title: input.title,
				aspectRatio: input.aspectRatio,
				createdAt: now,
				updatedAt: now,
			};
			await createDb(c.env.DB).insert(projects).values(row);
			return c.json(row, 201);
		},
	)
	// 作品をまるごと返す。relations は定義せず、作品行と scenes / shots / sketches の
	// 4 つの select を batch で 1 往復にして TS で組み立てる（設計書 §4）
	.get("/:id", async (c) => {
		const id = c.req.param("id");
		const db = createDb(c.env.DB);
		const [projectRows, sceneRows, shotRows, sketchRows] = await db.batch([
			db.select().from(projects).where(eq(projects.id, id)),
			db
				.select()
				.from(scenes)
				.where(eq(scenes.projectId, id))
				.orderBy(scenes.position),
			db
				.select(getTableColumns(shots))
				.from(shots)
				.innerJoin(scenes, eq(shots.sceneId, scenes.id))
				.where(eq(scenes.projectId, id))
				.orderBy(shots.position),
			db
				.select({ shotId: sketches.shotId, data: sketches.data })
				.from(sketches)
				.innerJoin(shots, eq(sketches.shotId, shots.id))
				.innerJoin(scenes, eq(shots.sceneId, scenes.id))
				.where(eq(scenes.projectId, id)),
		]);
		const project = projectRows[0];
		if (!project) return c.json({ error: "not_found" as const }, 404);
		const sketchByShot = new Map(
			sketchRows.map((r) => [r.shotId, JSON.parse(r.data) as SketchData]),
		);
		return c.json({
			...project,
			scenes: sceneRows.map((scene) => ({
				...scene,
				shots: shotRows
					.filter((shot) => shot.sceneId === scene.id)
					.map((shot) => ({
						...shot,
						sketch: sketchByShot.get(shot.id) ?? null,
					})),
			})),
		});
	})
	.post(
		"/:id/scenes",
		zValidator("json", createSceneSchema, validationHook),
		async (c) => {
			const projectId = c.req.param("id");
			const { title } = c.req.valid("json");
			const db = createDb(c.env.DB);
			const project = await db
				.select({ id: projects.id })
				.from(projects)
				.where(eq(projects.id, projectId))
				.get();
			if (!project) return c.json({ error: "not_found" as const }, 404);
			const siblings = await db
				.select({ number: scenes.number, position: scenes.position })
				.from(scenes)
				.where(eq(scenes.projectId, projectId));
			const row: typeof scenes.$inferSelect = {
				id: crypto.randomUUID(),
				projectId,
				position: nextPosition(siblings.map((s) => s.position)),
				number: nextNumber(siblings.map((s) => s.number)),
				title,
			};
			await db.insert(scenes).values(row);
			return c.json(row, 201);
		},
	);
