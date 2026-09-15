import { pbkdf2Sync, randomBytes } from "node:crypto";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// テスト用パスワード "test-password" の PBKDF2 ハッシュ（server/auth.ts と同じ形式）
function testPasswordHash(): string {
	const iterations = 1000;
	const salt = randomBytes(16);
	const hash = pbkdf2Sync("test-password", salt, iterations, 32, "sha256");
	return `pbkdf2$${iterations}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export default defineConfig(async () => {
	const migrations = await readD1Migrations("./drizzle");
	return {
		plugins: [
			cloudflareTest({
				miniflare: {
					compatibilityDate: "2025-09-02",
					d1Databases: { DB: "storyboard-test" },
					bindings: {
						TEST_MIGRATIONS: migrations,
						PASSWORD_HASH: testPasswordHash(),
						SESSION_SECRET: "test-session-secret",
					},
				},
			}),
		],
		test: {
			name: "api",
			include: ["server/**/*.api.test.ts"],
			setupFiles: [
				"./server/test/apply-migrations.ts",
				"./server/test/reset-db.ts",
			],
		},
	};
});
