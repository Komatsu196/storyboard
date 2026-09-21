import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { createDb } from "./db";
import { projects } from "./db/schema";

it("inserts and reads a project through drizzle", async () => {
	const db = createDb(env.DB);
	const now = new Date().toISOString();
	await db
		.insert(projects)
		.values({ id: "p1", title: "テスト", createdAt: now, updatedAt: now });
	const rows = await db.select().from(projects);
	expect(rows).toEqual([
		{
			id: "p1",
			title: "テスト",
			aspectRatio: "16:9",
			createdAt: now,
			updatedAt: now,
		},
	]);
});

it("starts each test with an empty database", async () => {
	const db = createDb(env.DB);
	expect(await db.select().from(projects)).toEqual([]);
});
