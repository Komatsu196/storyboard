import { env } from "cloudflare:workers";
import { serializeSigned } from "hono/utils/cookie";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { json } from "./test/authed";

const app = createApp();

async function login(password: string): Promise<Response> {
	return app.request("/api/login", json("POST", { password }), env);
}

async function loginCookie(password = "test-password"): Promise<string> {
	const res = await login(password);
	expect(res.status).toBe(204);
	return (res.headers.get("set-cookie") ?? "").split(";")[0];
}

const session = (cookie: string) =>
	app.request("/api/session", { headers: { cookie } }, env);

const changePassword = (cookie: string, body: unknown) => {
	const init = json("POST", body);
	return app.request(
		"/api/password",
		{
			...init,
			headers: { ...(init.headers as Record<string, string>), cookie },
		},
		env,
	);
};

describe("password change", () => {
	it("changes the password and keeps this device logged in", async () => {
		const cookie = await loginCookie();
		const res = await changePassword(cookie, {
			current: "test-password",
			next: "new-password-1",
		});
		expect(res.status).toBe(204);
		const renewed = (res.headers.get("set-cookie") ?? "").split(";")[0];
		expect(renewed).toMatch(/^session=/);
		expect((await session(renewed)).status).toBe(200);

		expect((await login("test-password")).status).toBe(401);
		expect((await login("new-password-1")).status).toBe(204);
	});

	it("logs out the other devices", async () => {
		const mine = await loginCookie();
		const other = await loginCookie();
		await changePassword(mine, {
			current: "test-password",
			next: "new-password-1",
		});
		expect((await session(other)).status).toBe(401);
		expect((await session(mine)).status).toBe(401);
	});

	it("rejects a wrong current password with 400 and keeps the password", async () => {
		const cookie = await loginCookie();
		const res = await changePassword(cookie, {
			current: "wrong",
			next: "new-password-1",
		});
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: "wrong_password" });
		expect((await session(cookie)).status).toBe(200);
		expect((await login("test-password")).status).toBe(204);
	});

	it("rejects a new password shorter than 8 characters", async () => {
		const cookie = await loginCookie();
		const res = await changePassword(cookie, {
			current: "test-password",
			next: "short",
		});
		expect(res.status).toBe(400);
		expect((await login("test-password")).status).toBe(204);
	});

	it("requires a session", async () => {
		const res = await app.request(
			"/api/password",
			json("POST", { current: "test-password", next: "new-password-1" }),
			env,
		);
		expect(res.status).toBe(401);
	});

	it("falls back to the PASSWORD_HASH secret when the auth row is deleted", async () => {
		const cookie = await loginCookie();
		await changePassword(cookie, {
			current: "test-password",
			next: "new-password-1",
		});
		await env.DB.prepare("delete from auth").run();
		expect((await login("new-password-1")).status).toBe(401);
		const restored = await loginCookie("test-password");
		expect((await session(restored)).status).toBe(200);
	});

	it("rejects an old-format cookie that only holds the expiry", async () => {
		const exp = Math.floor(Date.now() / 1000) + 3600;
		const cookie = (
			await serializeSigned("session", String(exp), env.SESSION_SECRET)
		).split(";")[0];
		expect((await session(cookie)).status).toBe(401);
	});
});
