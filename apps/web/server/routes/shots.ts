import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { updateShotSchema } from "../../shared/schemas";
import { sketchDataSchema } from "../../shared/sketch/types";
import { createDb } from "../db";
import { shots, sketches } from "../db/schema";
import { validationHook } from "../validate";

export const shotRoutes = new Hono<{ Bindings: Env }>()
	// カット情報 7 項目。送られた項目だけ更新し、updated_at を進める（設計書 §4）
	.patch(
		"/:id",
		zValidator("json", updateShotSchema, validationHook),
		async (c) => {
			const id = c.req.param("id");
			const fields = c.req.valid("json");
			const row = await createDb(c.env.DB)
				.update(shots)
				.set({ ...fields, updatedAt: new Date().toISOString() })
				.where(eq(shots.id, id))
				.returning()
				.get();
			if (!row) return c.json({ error: "not_found" as const }, 404);
			return c.json(row);
		},
	)
	.put(
		"/:id/sketch",
		bodyLimit({
			maxSize: 1024 * 1024,
			// デフォルトの onError は例外を投げ、app.onError が 500 にしてしまう。413 を直接返す
			onError: (c) => c.json({ error: "too_large" as const }, 413),
		}),
		zValidator("json", sketchDataSchema, validationHook),
		async (c) => {
			const shotId = c.req.param("id");
			const data = c.req.valid("json");
			const db = createDb(c.env.DB);
			const shot = await db
				.select({ id: shots.id })
				.from(shots)
				.where(eq(shots.id, shotId))
				.get();
			if (!shot) return c.json({ error: "not_found" as const }, 404);
			const now = new Date().toISOString();
			const json = JSON.stringify(data);
			// upsert。最後の書き込みが勝つ（単一ユーザー）
			await db
				.insert(sketches)
				.values({ shotId, data: json, updatedAt: now })
				.onConflictDoUpdate({
					target: sketches.shotId,
					set: { data: json, updatedAt: now },
				});
			return c.body(null, 204);
		},
	)
	// 物理削除。スケッチは ON DELETE CASCADE で消える
	.delete("/:id", async (c) => {
		const row = await createDb(c.env.DB)
			.delete(shots)
			.where(eq(shots.id, c.req.param("id")))
			.returning({ id: shots.id })
			.get();
		if (!row) return c.json({ error: "not_found" as const }, 404);
		return c.body(null, 204);
	});
