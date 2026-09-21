import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { sketchDataSchema } from "../../shared/sketch/types";
import { createDb } from "../db";
import { shots, sketches } from "../db/schema";
import { validationHook } from "../validate";

export const shotRoutes = new Hono<{ Bindings: Env }>().put(
	"/:id/sketch",
	bodyLimit({ maxSize: 1024 * 1024 }),
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
);
