import { env } from "cloudflare:workers";
import { beforeEach } from "vitest";

// ストレージの分離はテストファイル単位なので、各テストの前に作品を全削除する（cascade で子も消える）
beforeEach(async () => {
	await env.DB.prepare("delete from projects").run();
});
