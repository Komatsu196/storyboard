import { env } from "cloudflare:workers";
import { beforeEach } from "vitest";

// ストレージの分離はテストファイル単位なので、各テストの前に作品を全削除する（cascade で子も消える）。
// パスワードも Secret のテスト用パスワードに戻す（T-035）
beforeEach(async () => {
	await env.DB.prepare("delete from projects").run();
	await env.DB.prepare("delete from auth").run();
});
