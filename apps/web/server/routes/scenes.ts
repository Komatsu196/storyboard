import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { orderSchema, updateSceneSchema } from "../../shared/schemas";
import { createDb } from "../db";
import { scenes, shots } from "../db/schema";
import { nextNumber, nextPosition, sameIdSet } from "../numbering";
import { validationHook } from "../validate";

export const sceneRoutes = new Hono<{ Bindings: Env }>()
	.post("/:id/shots", async (c) => {
		const sceneId = c.req.param("id");
		const db = createDb(c.env.DB);
		const scene = await db
			.select({ id: scenes.id })
			.from(scenes)
			.where(eq(scenes.id, sceneId))
			.get();
		if (!scene) return c.json({ error: "not_found" as const }, 404);
		const siblings = await db
			.select({ number: shots.number, position: shots.position })
			.from(shots)
			.where(eq(shots.sceneId, sceneId));
		const now = new Date().toISOString();
		const row: typeof shots.$inferSelect = {
			id: crypto.randomUUID(),
			sceneId,
			position: nextPosition(siblings.map((s) => s.position)),
			number: nextNumber(siblings.map((s) => s.number)),
			shotSize: null,
			cameraMove: "",
			action: "",
			dialogue: "",
			durationSec: null,
			notes: "",
			createdAt: now,
			updatedAt: now,
		};
		await db.insert(shots).values(row);
		return c.json({ ...row, sketch: null }, 201);
	})
	// 番号・タイトル(T-018)。scenes には updated_at が無いので、送られた項目を更新するだけ
	.patch(
		"/:id",
		zValidator("json", updateSceneSchema, validationHook),
		async (c) => {
			const id = c.req.param("id");
			const input = c.req.valid("json");
			const db = createDb(c.env.DB);
			const current = await db
				.select()
				.from(scenes)
				.where(eq(scenes.id, id))
				.get();
			if (!current) return c.json({ error: "not_found" as const }, 404);
			// Drizzle は空の set を受け付けないので、{} のときは今の行をそのまま返す
			if (Object.keys(input).length === 0) return c.json(current);
			const row = await db
				.update(scenes)
				.set(input)
				.where(eq(scenes.id, id))
				.returning()
				.get();
			return c.json(row ?? current);
		},
	)
	// 物理削除。カット・スケッチは ON DELETE CASCADE で消える
	.delete("/:id", async (c) => {
		const row = await createDb(c.env.DB)
			.delete(scenes)
			.where(eq(scenes.id, c.req.param("id")))
			.returning({ id: scenes.id })
			.get();
		if (!row) return c.json({ error: "not_found" as const }, 404);
		return c.body(null, 204);
	})
	// 並べ替え（T-007 / T-017）。シーンをまたぐ移動はしない（Later）
	.put(
		"/:id/shots/order",
		zValidator("json", orderSchema, validationHook),
		async (c) => {
			const sceneId = c.req.param("id");
			const { ids } = c.req.valid("json");
			const db = createDb(c.env.DB);
			const scene = await db
				.select({ id: scenes.id })
				.from(scenes)
				.where(eq(scenes.id, sceneId))
				.get();
			if (!scene) return c.json({ error: "not_found" as const }, 404);
			const current = await db
				.select({ id: shots.id })
				.from(shots)
				.where(eq(shots.sceneId, sceneId));
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
				db.update(shots).set({ position }).where(eq(shots.id, id)),
			);
			if (first) await db.batch([first, ...rest]);
			return c.body(null, 204);
		},
	);
