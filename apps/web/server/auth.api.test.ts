import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";

const app = createApp();
const json = (body: unknown): RequestInit => ({
	method: "POST",
	headers: { "content-type": "application/json" },
	body: JSON.stringify(body),
});

async function loginCookie(): Promise<string> {
	const res = await app.request(
		"/api/login",
		json({ password: "test-password" }),
		env,
	);
	expect(res.status).toBe(204);
	const setCookie = res.headers.get("set-cookie") ?? "";
	return setCookie.split(";")[0];
}

describe("auth", () => {
	it("rejects a wrong password", async () => {
		const res = await app.request(
			"/api/login",
			json({ password: "nope" }),
			env,
		);
		expect(res.status).toBe(401);
	});

	it("rejects a malformed body", async () => {
		const res = await app.request("/api/login", json({}), env);
		expect(res.status).toBe(400);
	});

	it("logs in and returns an HttpOnly session cookie", async () => {
		const res = await app.request(
			"/api/login",
			json({ password: "test-password" }),
			env,
		);
		expect(res.status).toBe(204);
		const cookie = res.headers.get("set-cookie") ?? "";
		expect(cookie).toMatch(/^session=/);
		expect(cookie).toContain("HttpOnly");
		expect(cookie).toContain("SameSite=Lax");
	});

	it("accepts the cookie on /api/session", async () => {
		const cookie = await loginCookie();
		const res = await app.request("/api/session", { headers: { cookie } }, env);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
	});

	it("rejects requests without a cookie", async () => {
		const res = await app.request("/api/session", {}, env);
		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ error: "unauthorized" });
	});

	it("rejects a tampered cookie", async () => {
		const cookie = await loginCookie();
		const tampered = cookie.replace(/^session=\d/, (m) =>
			m.endsWith("9") ? "session=1" : `session=${Number(m.slice(-1)) + 1}`,
		);
		const res = await app.request(
			"/api/session",
			{ headers: { cookie: tampered } },
			env,
		);
		expect(res.status).toBe(401);
	});

	it("logs out by clearing the cookie", async () => {
		const cookie = await loginCookie();
		const res = await app.request(
			"/api/logout",
			{ method: "POST", headers: { cookie } },
			env,
		);
		expect(res.status).toBe(204);
		expect(res.headers.get("set-cookie")).toMatch(/^session=;/);
	});
});
