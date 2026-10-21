import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import {
	currentPasswordHash,
	endSession,
	hashPassword,
	requireSession,
	savePasswordHash,
	startSession,
	verifyPassword,
} from "./auth";
import { projectRoutes } from "./routes/projects";
import { sceneRoutes } from "./routes/scenes";
import { shotRoutes } from "./routes/shots";

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
				const passwordHash = await currentPasswordHash(c.env);
				if (!(await verifyPassword(password, passwordHash))) {
					return c.json({ error: "unauthorized" }, 401);
				}
				await startSession(c, c.env.SESSION_SECRET, passwordHash);
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
		// 今のパスワードが違うときは 401 にしない（SPA がログイン画面へ移ってしまうため、T-037）
		.post(
			"/password",
			zValidator(
				"json",
				z.object({ current: z.string(), next: z.string().min(8) }),
			),
			async (c) => {
				const { current, next } = c.req.valid("json");
				if (
					!(await verifyPassword(current, await currentPasswordHash(c.env)))
				) {
					return c.json({ error: "wrong_password" }, 400);
				}
				const passwordHash = await hashPassword(next);
				await savePasswordHash(c.env, passwordHash);
				// この端末だけ新しいソルトで Cookie を出し直す。他の端末は次の API で 401 になる（T-036）
				await startSession(c, c.env.SESSION_SECRET, passwordHash);
				return c.body(null, 204);
			},
		)
		.route("/projects", projectRoutes)
		.route("/scenes", sceneRoutes)
		.route("/shots", shotRoutes);

	return routes;
}

export type AppType = ReturnType<typeof createApp>;
