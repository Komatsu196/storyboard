import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// setup ファイルは複数回実行されうるが、applyD1Migrations は未適用分だけを適用するので安全
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
