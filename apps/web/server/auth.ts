import type { Context } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";

export const SESSION_COOKIE = "session";
export const SESSION_TTL_SEC = 90 * 24 * 60 * 60;
const PBKDF2_ITERATIONS = 100_000;

function toBase64Url(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
	const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
	const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
	return Uint8Array.from(atob(padded), (ch) => ch.charCodeAt(0));
}

async function pbkdf2(
	password: string,
	salt: Uint8Array,
	iterations: number,
): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", hash: "SHA-256", salt, iterations },
		key,
		256,
	);
	return new Uint8Array(bits);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
	return diff === 0;
}

/** 形式: pbkdf2$<iterations>$<salt b64url>$<hash b64url>（scripts/hash-password.mjs と同じ） */
export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
	return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

export async function verifyPassword(
	password: string,
	stored: string,
): Promise<boolean> {
	const [scheme, iterationsStr, saltStr, hashStr] = stored.split("$");
	if (scheme !== "pbkdf2" || !iterationsStr || !saltStr || !hashStr)
		return false;
	const iterations = Number(iterationsStr);
	if (!Number.isInteger(iterations) || iterations <= 0) return false;
	const actual = await pbkdf2(password, fromBase64Url(saltStr), iterations);
	return timingSafeEqual(actual, fromBase64Url(hashStr));
}

export async function startSession(c: Context, secret: string): Promise<void> {
	const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
	await setSignedCookie(c, SESSION_COOKIE, String(exp), secret, {
		httpOnly: true,
		// http://localhost では Secure を付けない（Safari が Secure Cookie を捨てるため）
		secure: c.req.url.startsWith("https:"),
		sameSite: "Lax",
		path: "/",
		maxAge: SESSION_TTL_SEC,
	});
}

export function endSession(c: Context): void {
	deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export async function hasValidSession(
	c: Context,
	secret: string,
): Promise<boolean> {
	const value = await getSignedCookie(c, secret, SESSION_COOKIE);
	if (!value) return false;
	const exp = Number(value);
	return Number.isFinite(exp) && exp > Math.floor(Date.now() / 1000);
}

export const requireSession = createMiddleware<{ Bindings: Env }>(
	async (c, next) => {
		if (!(await hasValidSession(c, c.env.SESSION_SECRET))) {
			return c.json({ error: "unauthorized" }, 401);
		}
		await next();
	},
);
