import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import {
	endSession,
	requireSession,
	startSession,
	verifyPassword,
} from "./auth";
import { projectRoutes } from "./routes/projects";

export function createApp() {
	const app = new Hono<{ Bindings: Env }>().basePath("/api");

	app.onError((err, c) => {
		console.error(err);
		return c.json({ error: "internal" }, 500);
	});
	app.notFound((c) => c.json({ error: "not_found" }, 404));

	const routes = app
		.post(
			"/login",
			zValidator("json", z.object({ password: z.string() })),
			async (c) => {
				const { password } = c.req.valid("json");
				if (!(await verifyPassword(password, c.env.PASSWORD_HASH))) {
					return c.json({ error: "unauthorized" }, 401);
				}
				await startSession(c, c.env.SESSION_SECRET);
				return c.body(null, 204);
			},
		)
		// ここから下のルートはすべてログイン必須
		.use("/*", requireSession)
		.post("/logout", (c) => {
			endSession(c);
			return c.body(null, 204);
		})
		.get("/session", (c) => c.json({ ok: true }))
		.route("/projects", projectRoutes);

	return routes;
}

export type AppType = ReturnType<typeof createApp>;
