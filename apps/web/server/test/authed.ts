import { env } from "cloudflare:workers";
import type { createApp } from "../app";

type App = ReturnType<typeof createApp>;
type Authed = (path: string, init?: RequestInit) => Promise<Response>;

export function json(method: string, body: unknown): RequestInit {
	return {
		method,
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	};
}

/** テスト用パスワードでログインし、その Cookie を付けてリクエストする関数を返す */
export async function authed(app: App): Promise<Authed> {
	const res = await app.request(
		"/api/login",
		json("POST", { password: "test-password" }),
		env,
	);
	if (res.status !== 204) throw new Error(`login failed: ${res.status}`);
	const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
	return async (path, init = {}) =>
		app.request(
			path,
			{
				...init,
				headers: {
					cookie,
					...(init.headers as Record<string, string> | undefined),
				},
			},
			env,
		);
}
