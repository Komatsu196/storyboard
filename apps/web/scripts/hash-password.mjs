// 使い方: node scripts/hash-password.mjs "パスワード"
// 出力を PASSWORD_HASH として .dev.vars（ローカル）/ wrangler secret put（本番）に登録する。
// 形式は server/auth.ts の verifyPassword と同じ: pbkdf2$<iterations>$<salt b64url>$<hash b64url>
import { pbkdf2Sync, randomBytes } from "node:crypto";

const password = process.argv[2];
if (!password) {
	console.error('usage: node scripts/hash-password.mjs "<password>"');
	process.exit(1);
}
const iterations = 100_000;
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256");
console.log(
	`pbkdf2$${iterations}$${salt.toString("base64url")}$${hash.toString("base64url")}`,
);
