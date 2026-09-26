import { zValidator } from "@hono/zod-validator";
import { desc, eq, getTableColumns } from "drizzle-orm";
import { Hono } from "hono";
import {
	createProjectSchema,
	createSceneSchema,
	orderSchema,
	updateProjectSchema,
} from "../../shared/schemas";
import { recenterSketch } from "../../shared/sketch/recenter";
import { canvasSizes, type SketchData } from "../../shared/sketch/types";
import { createDb } from "../db";
import { projects, scenes, shots, sketches } from "../db/schema";
import { nextNumber, nextPosition, sameIdSet } from "../numbering";
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
	// 作品名・アスペクト比（T-019）。比率が変わるときは作品の全スケッチを中央合わせに書き換え、
	// 作品行と一緒に 1 つの batch で書く（T-020。D1 の batch は原子的）
	.patch(
		"/:id",
		zValidator("json", updateProjectSchema, validationHook),
		async (c) => {
			const id = c.req.param("id");
			const input = c.req.valid("json");
			const db = createDb(c.env.DB);
			const current = await db
				.select()
				.from(projects)
				.where(eq(projects.id, id))
				.get();
			if (!current) return c.json({ error: "not_found" as const }, 404);
			const now = new Date().toISOString();
			const updateProject = db
				.update(projects)
				.set({ ...input, updatedAt: now })
				.where(eq(projects.id, id))
				.returning();
			// 比率が変わるときだけ新しい枠の大きさ（変わらなければ null でスケッチは触らない）
			const size =
				input.aspectRatio !== undefined &&
				input.aspectRatio !== current.aspectRatio
					? canvasSizes[input.aspectRatio]
					: null;
			const rows = size
				? await db
						.select({ shotId: sketches.shotId, data: sketches.data })
						.from(sketches)
						.innerJoin(shots, eq(sketches.shotId, shots.id))
						.innerJoin(scenes, eq(shots.sceneId, scenes.id))
						.where(eq(scenes.projectId, id))
				: [];
			const updateSketches =
				size === null
					? []
					: rows.map((r) =>
							db
								.update(sketches)
								.set({
									data: JSON.stringify(
										recenterSketch(JSON.parse(r.data) as SketchData, size),
									),
									updatedAt: now,
								})
								.where(eq(sketches.shotId, r.shotId)),
						);
			const [updated] = await db.batch([updateProject, ...updateSketches]);
			const row = updated[0];
			if (!row) return c.json({ error: "not_found" as const }, 404);
			return c.json(row);
		},
	)
	// 物理削除。シーン・カット・スケッチは ON DELETE CASCADE で消える
	.delete("/:id", async (c) => {
		const row = await createDb(c.env.DB)
			.delete(projects)
			.where(eq(projects.id, c.req.param("id")))
			.returning({ id: projects.id })
			.get();
		if (!row) return c.json({ error: "not_found" as const }, 404);
		return c.body(null, 204);
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
	)
	// 並べ替え（T-007 / T-017）。ids が今のシーンとちょうど同じ集合なら、その順で position を 0..n-1 に振り直す
	.put(
		"/:id/scenes/order",
		zValidator("json", orderSchema, validationHook),
		async (c) => {
			const projectId = c.req.param("id");
			const { ids } = c.req.valid("json");
			const db = createDb(c.env.DB);
			const project = await db
				.select({ id: projects.id })
				.from(projects)
				.where(eq(projects.id, projectId))
				.get();
			if (!project) return c.json({ error: "not_found" as const }, 404);
			const current = await db
				.select({ id: scenes.id })
				.from(scenes)
				.where(eq(scenes.projectId, projectId));
			if (
				!sameIdSet(
					ids,
					current.map((s) => s.id),
				)
			) {
				return c.json(
					{
						error: "validation" as const,
						issues: [{ message: "ids must be exactly the current siblings" }],
					},
					400,
				);
			}
			const [first, ...rest] = ids.map((id, position) =>
				db.update(scenes).set({ position }).where(eq(scenes.id, id)),
			);
			if (first) await db.batch([first, ...rest]);
			return c.body(null, 204);
		},
	);
