# storyboard web

絵コンテ管理アプリ本体。1つの Cloudflare Worker で SPA（Vite + React + TanStack Router）と API（Hono、`/api/*`）を配信し、データは D1 に置く。設計の記録は `docs/tech/decisions.md`（T-001〜T-020）。

## セットアップ

```bash
pnpm install
node scripts/hash-password.mjs "好きなパスワード"   # → PASSWORD_HASH
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"  # → SESSION_SECRET
```

`apps/web/.dev.vars` を作る（git 管理外）:

```
PASSWORD_HASH="pbkdf2$100000$…"
SESSION_SECRET="…"
```

```bash
pnpm types              # worker-configuration.d.ts を生成（wrangler.jsonc / .dev.vars を変えたら再実行）
pnpm db:migrate:local   # ローカル D1 にマイグレーション適用
pnpm dev                # http://localhost:3000
```

## スクリプト

| コマンド | 内容 |
| --- | --- |
| `pnpm dev` | SPA（HMR）と Worker とローカル D1 を同時に起動 |
| `pnpm test` | Vitest（`unit`: node / `api`: Workers ランタイム＋D1） |
| `pnpm check` | `wrangler types` → Biome → `tsc -b`（コミット前に通す） |
| `pnpm db:generate --name <名前>` | `server/db/schema.ts` の変更から `drizzle/` に SQL を生成 |
| `pnpm db:migrate:local` / `pnpm db:migrate:remote` | ローカル / 本番 D1 にマイグレーション適用 |
| `pnpm run deploy` | `vite build` → `wrangler deploy`（`pnpm deploy` ではなく **`pnpm run deploy`**） |

## 初回デプロイ（一度だけ）

```bash
pnpm exec wrangler login                       # ブラウザで Cloudflare にログイン
pnpm exec wrangler d1 create storyboard        # 出力の database_id を wrangler.jsonc に貼る
pnpm db:migrate:local                          # database_id を変えるとローカル D1 も別ファイルになるので再適用
pnpm db:migrate:remote
node scripts/hash-password.mjs "本番のパスワード" | pnpm exec wrangler secret put PASSWORD_HASH
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))" | pnpm exec wrangler secret put SESSION_SECRET
pnpm run deploy
```

## 2回目以降のデプロイ

```bash
pnpm check && pnpm test
pnpm db:migrate:remote   # マイグレーションを足したときだけ
pnpm run deploy
```

## 構成

```
src/      SPA（routes/ はファイルベースルーティング。認証必須ページは routes/_authed/ 配下）
src/sketch/  スケッチエディタ（SketchCanvas・Toolbar・SketchThumb・描画関数 render.ts・状態フック）
src/components/  作品ページのカード（ShotCard・shotMeta）・編集モード（SceneHeader・ItemActions・InlineField・useStructureMutations）・8項目フォーム（ShotForm）・自動保存（useAutosave・autosaver）
server/   Hono Worker（app.ts がルート、routes/ がサブアプリ、auth.ts が認証、db/ が Drizzle）
shared/   SPA と Worker の両方から使う純粋なコード（zod スキーマ・並べ替え order.ts・sketch/ の幾何ロジックと状態遷移・アスペクト比変更 sketch/recenter.ts）
drizzle/  マイグレーション SQL
```
