import {
	index,
	integer,
	real,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
	id: text("id").primaryKey(),
	title: text("title").notNull(),
	aspectRatio: text("aspect_ratio").notNull().default("16:9"),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});

export const scenes = sqliteTable(
	"scenes",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		position: integer("position").notNull(),
		number: text("number").notNull(),
		title: text("title").notNull().default(""),
	},
	(t) => [index("scenes_project_position").on(t.projectId, t.position)],
);

export const shots = sqliteTable(
	"shots",
	{
		id: text("id").primaryKey(),
		sceneId: text("scene_id")
			.notNull()
			.references(() => scenes.id, { onDelete: "cascade" }),
		position: integer("position").notNull(),
		number: text("number").notNull(),
		shotSize: text("shot_size"),
		cameraMove: text("camera_move").notNull().default(""),
		action: text("action").notNull().default(""),
		dialogue: text("dialogue").notNull().default(""),
		durationSec: real("duration_sec"),
		notes: text("notes").notNull().default(""),
		createdAt: text("created_at").notNull(),
		updatedAt: text("updated_at").notNull(),
	},
	(t) => [index("shots_scene_position").on(t.sceneId, t.position)],
);

export const sketches = sqliteTable("sketches", {
	shotId: text("shot_id")
		.primaryKey()
		.references(() => shots.id, { onDelete: "cascade" }),
	data: text("data").notNull(),
	updatedAt: text("updated_at").notNull(),
});

/** パスワードのハッシュを置く 1 行だけのテーブル（id は 1 固定）。行がなければ Secret の PASSWORD_HASH を使う（T-035） */
export const auth = sqliteTable("auth", {
	id: integer("id").primaryKey(),
	passwordHash: text("password_hash").notNull(),
	updatedAt: text("updated_at").notNull(),
});
