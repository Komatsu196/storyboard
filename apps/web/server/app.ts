import { Hono } from "hono";

export function createApp() {
	const app = new Hono<{ Bindings: Env }>().basePath("/api");

	app.onError((err, c) => {
		console.error(err);
		return c.json({ error: "internal" }, 500);
	});
	app.notFound((c) => c.json({ error: "not_found" }, 404));

	return app;
}

export type AppType = ReturnType<typeof createApp>;
