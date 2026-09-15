import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./auth";

describe("password hashing", () => {
	it("verifies the same password", async () => {
		const stored = await hashPassword("correct horse");
		expect(stored.startsWith("pbkdf2$100000$")).toBe(true);
		expect(await verifyPassword("correct horse", stored)).toBe(true);
	});

	it("rejects a different password", async () => {
		const stored = await hashPassword("correct horse");
		expect(await verifyPassword("wrong", stored)).toBe(false);
	});

	it("rejects malformed stored values", async () => {
		expect(await verifyPassword("x", "")).toBe(false);
		expect(await verifyPassword("x", "plain$1$2$3")).toBe(false);
		expect(await verifyPassword("x", "pbkdf2$abc$salt$hash")).toBe(false);
	});
});
