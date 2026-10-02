import { zValidator } from "@hono/zod-validator";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { orderSchema, updateSceneSchema } from "../../shared/schemas";
import type { SketchData } from "../../shared/sketch/types";
import { createDb } from "../db";
import { scenes, shots, sketches } from "../db/schema";
import {
	duplicateNumber,
	nextNumber,
	nextPosition,
	sameIdSet,
} from "../numbering";
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
	// 複製（T-033）。元のすぐ後ろにタイトルと中のカットすべて（番号・7 項目・スケッチ）を写したシーンを作り、後ろのシーンを 1 つずつずらす。
	// カットとスケッチは「元の ID → 新しい ID」の対応を json_each で渡す INSERT … SELECT にし、カットの数によらず文の数と引数の数を一定にする（D1 の 1 文あたりの引数は 100 まで）
	.post("/:id/duplicate", async (c) => {
		const id = c.req.param("id");
		const db = createDb(c.env.DB);
		const [siblings, shotRows, sketchRows] = await db.batch([
			db
				.select()
				.from(scenes)
				.where(
					inArray(
						scenes.projectId,
						db
							.select({ projectId: scenes.projectId })
							.from(scenes)
							.where(eq(scenes.id, id)),
					),
				),
			db
				.select()
				.from(shots)
				.where(eq(shots.sceneId, id))
				.orderBy(shots.position),
			db
				.select({ shotId: sketches.shotId, data: sketches.data })
				.from(sketches)
				.innerJoin(shots, eq(sketches.shotId, shots.id))
				.where(eq(shots.sceneId, id)),
		]);
		const source = siblings.find((s) => s.id === id);
		if (!source) return c.json({ error: "not_found" as const }, 404);
		const row: typeof scenes.$inferSelect = {
			...source,
			id: crypto.randomUUID(),
			position: source.position + 1,
			number: duplicateNumber(
				source.number,
				siblings.map((s) => s.number),
			),
		};
		const now = new Date().toISOString();
		const idMap = new Map(shotRows.map((s) => [s.id, crypto.randomUUID()]));
		const pairs = JSON.stringify(
			[...idMap].map(([from, to]) => ({ from, to })),
		);
		// 1 つの batch で書く（D1 の batch は原子的）
		await db.batch([
			db
				.update(scenes)
				.set({ position: sql`${scenes.position} + 1` })
				.where(
					and(
						eq(scenes.projectId, source.projectId),
						gt(scenes.position, source.position),
					),
				),
			db.insert(scenes).values(row),
			// 列はテーブルの定義順（drizzle が insert の列をその順に並べる）
			db.insert(shots).select(sql`
				select json_extract(m.value, '$.to'), ${row.id}, s.position, s.number, s.shot_size, s.camera_move, s.action, s.dialogue, s.duration_sec, s.notes, ${now}, ${now}
				from shots s join json_each(${pairs}) m on s.id = json_extract(m.value, '$.from')
			`),
			db.insert(sketches).select(sql`
				select json_extract(m.value, '$.to'), k.data, ${now}
				from sketches k join json_each(${pairs}) m on k.shot_id = json_extract(m.value, '$.from')
			`),
		]);
		const sketchByShot = new Map(
			sketchRows.map((r) => [r.shotId, JSON.parse(r.data) as SketchData]),
		);
		return c.json(
			{
				...row,
				shots: shotRows.map((shot) => ({
					...shot,
					id: idMap.get(shot.id) ?? shot.id,
					sceneId: row.id,
					createdAt: now,
					updatedAt: now,
					sketch: sketchByShot.get(shot.id) ?? null,
				})),
			},
			201,
		);
	})
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
