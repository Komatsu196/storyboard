import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { createDb } from "../db";
import { scenes, shots } from "../db/schema";
import { nextNumber, nextPosition } from "../numbering";

export const sceneRoutes = new Hono<{ Bindings: Env }>().post(
	"/:id/shots",
	async (c) => {
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
	},
);
