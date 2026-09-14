# 絵コンテ管理アプリ MVP 技術設計

作成日: 2026-09-14
対象: [プロダクト概要](../../product/overview.md)（D-001〜D-015）の MVP スコープ
決定の経緯: [技術決定事項ログ](../../tech/decisions.md)（T-001〜T-011）

## 1. 一行で

**Vite + React + TanStack Router の SPA と Hono API を1つの Cloudflare Worker に同居させ、データは D1 だけに置く。スケッチはストローク JSON を正として保存し、サムネイルも同じ描画関数でブラウザが描く。認証はパスワード1つと署名付き Cookie。**

## 2. 全体構成

```
ブラウザ（PC / スマホ）
  └ SPA: React 19 + TanStack Router + TanStack Query + Tailwind v4
        │  同一オリジン、Cookie 認証、JSON
        ▼
Cloudflare Worker（1つ）
  ├ Static Assets  … /            SPA の dist/client を配信（SPA フォールバック）
  └ Hono           … /api/*       run_worker_first でここだけ Worker が処理
        │  drizzle-orm/d1
        ▼
Cloudflare D1（SQLite）… projects / scenes / shots / sketches
```

| 決定 | 内容 |
| --- | --- |
| T-001 | SPA と API を1つの Worker に同居。CORS なし、デプロイ1回 |
| T-002 | DB は D1 ＋ Drizzle。ストレージは D1 のみ |
| T-003 | スケッチはストローク JSON のみ保存。PNG・R2 は使わない |
| T-004 | 認証はアプリ内パスワード＋HMAC 署名付き HttpOnly Cookie |
| T-005 | API は Hono ＋ zod、クライアントは Hono RPC ＋ TanStack Query |
| T-006 | 消しゴムはストローク単位。キャンバスは Canvas 2D ＋ Pointer Events で自作 |
| T-007 | 並べ替えは「前へ / 後へ」ボタン。DnD なし |
| T-008 | テストは純粋ロジックのユニット＋API 結合（vitest-pool-workers） |
| T-009 | `vite dev` 一本のローカル開発、手動デプロイ、CI なし |
| T-010 | apps/web 1パッケージ内を src/ server/ shared/ に分ける |
| T-011 | スケッチもカット情報も同じ自動保存。保存ボタンなし |

環境は「ローカル（`.dev.vars` ＋ ローカル D1）」と「本番（`*.workers.dev`）」の2つだけ。無料枠で運用する（Workers 10 万リクエスト/日、D1 5GB・読み 500 万行/日・書き 10 万行/日。静的アセットは無制限）。

## 3. データモデル

### 3.1 テーブル（D1 / Drizzle `sqlite-core`）

ID はサーバーで `crypto.randomUUID()`。時刻は ISO 8601 文字列（UTC、`"2026-09-14T03:00:00.000Z"`）を `text` 列に持つ。ユーザーテーブルは持たない。削除は物理削除で、子テーブルへ `ON DELETE CASCADE`。

```
projects
  id            text PK
  title         text NOT NULL
  aspect_ratio  text NOT NULL DEFAULT '16:9'   -- '16:9' | '9:16' | '4:3' | '2.39:1'
  created_at    text NOT NULL
  updated_at    text NOT NULL

scenes
  id            text PK
  project_id    text NOT NULL FK → projects.id (cascade)
  position      integer NOT NULL             -- 兄弟内の並び順（0 始まり）
  number        text NOT NULL                -- 自動採番＋手動調整
  title         text NOT NULL DEFAULT ''

shots
  id            text PK
  scene_id      text NOT NULL FK → scenes.id (cascade)
  position      integer NOT NULL
  number        text NOT NULL                -- 必須。空文字は不可（zod で弾く）。'2A' など枝番可
  shot_size     text                         -- NULL | 'LS'|'FS'|'MS'|'BS'|'CU'|'ECU'
  camera_move   text NOT NULL DEFAULT ''     -- 自由入力1列。UI が Fix/Pan/Tilt/Dolly/Handheld/Gimbal をチップで提示
  action        text NOT NULL DEFAULT ''     -- 内容（芝居・アクション）
  dialogue      text NOT NULL DEFAULT ''     -- セリフ・音
  duration_sec  real                         -- NULL 可
  notes         text NOT NULL DEFAULT ''     -- 備考
  created_at    text NOT NULL
  updated_at    text NOT NULL

sketches
  shot_id       text PK FK → shots.id (cascade)
  data          text NOT NULL                -- 3.2 の JSON
  updated_at    text NOT NULL
```

インデックス: `scenes(project_id, position)`、`shots(scene_id, position)`。

`sketches` をカット行と分けるのは、カット一覧のクエリがストロークを引きずらないようにするため（T-003）。

### 3.2 スケッチ JSON（`sketches.data`）

```json
{
  "v": 1,
  "w": 1600,
  "h": 900,
  "strokes": [
    { "color": "black", "size": 2, "p": [120, 340, 124, 344, 131, 350] }
  ]
}
```

- `v`: 形式バージョン（1 固定）。
- `w`, `h`: 論理座標系のサイズ。**長辺 1600 固定**で、作品のアスペクト比から決まる。

  | アスペクト比 | w × h |
  | --- | --- |
  | 16:9 | 1600 × 900 |
  | 9:16 | 900 × 1600 |
  | 4:3 | 1600 × 1200 |
  | 2.39:1 | 1600 × 670 |

  JSON 側にも `w`/`h` を持つので、作品のアスペクト比を後から変えても既存スケッチは新しいフレーム内に収めて（レターボックス）描ける。
- `strokes[].color`: `"black"` | `"red"`。
- `strokes[].size`: 太さ段階 `1 | 2 | 3`。線幅は論理単位で `6 / 12 / 20`（実装時に描き味で微調整可）。
- `strokes[].p`: 論理座標の整数を `x, y` 交互に並べた平坦配列（JSON を小さく保つため。偶数長）。
- 上限（zod）: ストローク 2,000 本、1本あたり点 10,000 個（数値 20,000 個）。`PUT sketch` のボディ上限 1MB。D1 の行サイズ上限 2MB に対して余裕を残す。
- 保存前に点を間引く: 直前に採用した点からの距離が 3 論理単位未満の点は捨てる（始点・終点は必ず残す）。

### 3.3 採番と並び順

- `position` は兄弟内の並び順だけを表す。作成時は `max(position) + 1`（兄弟なしなら 0）。並べ替え API で 0..n-1 に振り直す。
- `number` は作成時に「兄弟の `number` の先頭整数部分の最大値 + 1」（整数が1つもなければ 1）を文字列で入れる。以後はユーザーが手で編集する。並べ替えでは触らない（D-007）。
  - 例: 既存が `["1", "2", "2A", "3"]` → 次は `"4"`。既存が `["A", "B"]` → `"1"`。
- 純粋関数 `nextNumber(existing: string[]): string` と `reorder(ids: string[]) → position` を `server/numbering.ts` に置き、ユニットテストする。

## 4. API（Hono）

すべて `/api` 配下、JSON、キーは camelCase（Drizzle のスキーマで列名 snake_case → プロパティ camelCase に写像）。`/api/login` 以外は認証ミドルウェアを通し、未認証は `401 {"error":"unauthorized"}`。

| メソッド | パス | ボディ | 応答 |
| --- | --- | --- | --- |
| POST | `/api/login` | `{password}` | 204 ＋ `Set-Cookie: session=…`。不一致 401 |
| POST | `/api/logout` | — | 204、Cookie 削除 |
| GET | `/api/session` | — | 200 `{ok:true}` / 401 |
| GET | `/api/projects` | — | `Project[]`（`createdAt` 降順。子の変更で作品の `updatedAt` は動かさない） |
| POST | `/api/projects` | `{title, aspectRatio?}` | 201 `Project` |
| GET | `/api/projects/:id` | — | `ProjectDetail`（下記） |
| PATCH | `/api/projects/:id` | `{title?, aspectRatio?}` | 200 `Project` |
| DELETE | `/api/projects/:id` | — | 204 |
| POST | `/api/projects/:id/scenes` | `{title?}` | 201 `Scene` |
| PATCH | `/api/scenes/:id` | `{number?, title?}` | 200 `Scene` |
| DELETE | `/api/scenes/:id` | — | 204 |
| PUT | `/api/projects/:id/scenes/order` | `{ids: string[]}` | 204 |
| POST | `/api/scenes/:id/shots` | `{}` | 201 `Shot & {sketch: null}` |
| PATCH | `/api/shots/:id` | `{number?, shotSize?, cameraMove?, action?, dialogue?, durationSec?, notes?}` | 200 `Shot` |
| DELETE | `/api/shots/:id` | — | 204 |
| PUT | `/api/scenes/:id/shots/order` | `{ids: string[]}` | 204 |
| PUT | `/api/shots/:id/sketch` | `SketchData` | 204（upsert。最後の書き込みが勝つ） |

```ts
type ProjectDetail = Project & {
  scenes: (Scene & { shots: (Shot & { sketch: SketchData | null })[] })[]
}
```

- `GET /api/projects/:id` は作品を**まるごと**返す（シーン・カット・各カットのスケッチ JSON）。Drizzle のリレーショナルクエリで `position` 順に取得する。100 カット規模で数百 KB〜1MB（gzip 前）を想定。重くなったらシーン単位取得に切り替える余地を残す。
- 並べ替え `PUT …/order`: `ids` の集合が現在の兄弟の集合と一致しなければ 400。一致すれば `db.batch()` で `position` を受け取った順に振り直す（D1 の batch は原子的）。
- `PATCH` は送られた項目だけ更新し、その行の `updated_at` を進める（親の `updated_at` は触らない）。
- `Project` / `Scene` / `Shot` はテーブル行そのままの型（camelCase）。`sketch` はカット行には含めず、`ProjectDetail` と `POST shots` の応答でだけ付ける。
- 検証は `@hono/zod-validator`。失敗は `400 {"error":"validation","issues":[…]}`。存在しない ID は `404 {"error":"not_found"}`。未知の `/api/*` は 404。それ以外の例外は `500 {"error":"internal"}`。
- `shared/schemas.ts` が zod スキーマと固定リスト（アスペクト比・ショットサイズ・カメラの動きの候補）の唯一の定義場所。クライアントの選択肢 UI もここから生成する。
- Hono RPC 用に `export type AppType = typeof routes` を `server/app.ts` から公開する。

### 4.1 認証（T-004）

- Secret（`wrangler secret put` / ローカルは `.dev.vars`）:
  - `PASSWORD_HASH` — `pbkdf2$<iterations>$<salt b64url>$<hash b64url>`。README に生成コマンド（Node の `crypto.pbkdf2Sync` ワンライナー）を書く。
  - `SESSION_SECRET` — HMAC-SHA256 の鍵（32 バイト以上のランダム文字列）。
- `POST /api/login`: 入力パスワードを同じ salt・iterations で PBKDF2 し、タイミング安全に比較。成功したら `session=<exp>.<b64url(HMAC(exp))>` を発行。`exp` は unix 秒（90 日後）。
- Cookie 属性: `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=7776000`。localhost は secure context 扱いなのでローカル開発でも `Secure` のままでよい。
- ミドルウェア: Cookie を分解し `crypto.subtle.verify` で署名検証、`exp > now` を確認。失敗は 401。
- CSRF: 同一オリジン（T-001）＋ `SameSite=Lax` ＋ 状態変更は JSON ボディの POST/PUT/PATCH/DELETE のみ、で足りる。ログイン試行のレート制限は付けない（単一ユーザー・低リスクと判断。必要なら失敗時に 500ms 待つ程度）。

## 5. SPA

### 5.1 画面ルート（TanStack Router、ファイルベース）

```
src/routes/
  __root.tsx                                  QueryClientProvider・共通レイアウト
  login.tsx                                   /login
  _authed.tsx                                 認証ゲート（pathless layout）
  _authed/index.tsx                           /                              作品一覧
  _authed/projects.$projectId.tsx             /projects/:projectId           作品ページ
  _authed/projects.$projectId.shots.$shotId.tsx  /projects/:projectId/shots/:shotId  カット編集
```

| ルート | 内容 |
| --- | --- |
| `/login` | パスワード欄1つ。成功したら `?redirect=` の元ページへ（既定 `/`） |
| `/` | 作品一覧（タイトル・アスペクト比。`createdAt` 降順）。「＋作品」ダイアログ（タイトル・アスペクト比）。作品の削除。ヘッダにログアウト |
| `/projects/:projectId` | **作品ページ**。PC（`md` 以上）: シーンごとに見出し＋サムネイルのグリッド（`SketchThumb` ＋ カット番号・ショットサイズ・尺）。スマホ: 1カット1カードの縦スクロール（スケッチ＋8項目を読める形。現場用）。各シーン見出しに「＋カット」（そのシーンの末尾に追加）「＋シーン」（末尾に追加）、各シーン・カットのメニューに「前へ / 後へ / 番号・タイトル編集 / 削除」。作品名・アスペクト比の編集ダイアログ。スマホでは画面下に固定の「＋カット」（最後のシーンに追加。シーンが無ければ作る） |
| `/projects/:projectId/shots/:shotId` | **カット編集**。スマホ: キャンバス → ツールバー → 8項目フォームの縦並び。PC: キャンバス＋ツールバーを左、フォームを右。ヘッダに戻るリンクと保存状態（保存済み / 保存中 / 未保存） |

- 「＋カット → 即キャンバス」: `POST /api/scenes/:id/shots` → 応答のカットをキャッシュに差し込み → 編集ルートへ遷移。リクエスト1本。
- 認証ゲート `_authed.tsx` の `beforeLoad`: `queryClient.ensureQueryData(sessionQuery)`。401 なら `redirect({to: '/login', search: {redirect}})`。API 呼び出しの 401 も同じ処理（クライアントの fetch ラッパで検出して `/login` へ）。
- 削除はブラウザの `confirm()` で確認する（作品・シーン・カット）。全消し（スケッチ）は undo できるので確認なし。

### 5.2 データ取得（TanStack Query）

- クエリキー: `['session']`、`['projects']`、`['project', id]`。
- `hc<AppType>('/')` を `src/api/client.ts` に1つ作り、クエリ関数・ミューテーションのフックをそこにまとめる。
- 編集系ミューテーション（作成・PATCH・削除）は成功後に該当の `['project', id]`（作品一覧に影響するなら `['projects']` も）を invalidate。
- 並べ替えは楽観的更新（`onMutate` でキャッシュを並べ替え、失敗時は巻き戻して invalidate）。
- **スケッチとカット情報の自動保存は再取得せず `setQueryData` でキャッシュを直接更新**する（自動保存のたびに作品全体を取り直さない）。
- ルートの `loader` は `ensureQueryData` を呼ぶだけの薄い層。

### 5.3 自動保存（T-011）

`src/components/useAutosave.ts`:

```ts
useAutosave<T>(value: T, save: (v: T) => Promise<void>, { delay: number })
  → { status: 'saved' | 'saving' | 'unsaved', flush: () => Promise<void> }
```

- `value` が変わったら dirty にし、`delay` 後に `save`。連続変更中は延期。
- `flush()` を「フォーカスが外れたとき（項目）」「アンマウント時」「`visibilitychange` で hidden になったとき」「`pagehide`」に呼ぶ。離脱時の送信は `fetch(..., {keepalive: true})`（hono/client の `init` で渡す）。
- 失敗は指数バックオフで 3 回再試行（1s → 2s → 4s）。それでも失敗したら `unsaved` を表示し、次の変更でまた送る。ローカルの値は捨てない。
- 使い方: スケッチは `delay: 800`、8項目フォームは `delay: 1500`（8項目まとめて1つの `PATCH`）。

## 6. スケッチエディタ（T-003 / T-006）

### 6.1 モジュール

```
shared/sketch/
  types.ts       SketchData / Stroke の型と zod スキーマ、アスペクト比 → {w,h} の表、線幅表
  simplify.ts    simplifyPoints(p: number[], minDist = 3): number[]
  hitTest.ts     strokesHitByEraser(strokes, eraserPath: number[], radius = 16): number[]  // 当たった index
  history.ts     createHistory(initial) / push(next) / undo() / redo()  上限 100。strokes は不変更新
src/sketch/
  render.ts      renderStrokes(ctx, sketch, scale)  折れ線、lineCap/lineJoin = 'round'。エディタ・サムネイル共通
  SketchCanvas.tsx   入力処理と2層描画
  Toolbar.tsx        ペン（黒/赤）・太さ 1〜3・消しゴム・戻す・やり直す・全消し
  SketchThumb.tsx    作品ページ用の小さな canvas（DPR 対応）。空なら枠だけ
  useSketchEditor.ts tool / strokes / history / 自動保存をまとめた状態フック
```

`shared/sketch/*` は DOM にも Workers API にも依存しない純粋関数だけ（T-008）。

### 6.2 描画

- canvas 要素そのものがフレーム枠（作品のアスペクト比の箱、白背景、枠線）。親要素の幅いっぱいに表示し、高さはアスペクト比から決める。
- 2層: **base**（確定ストローク。確定・undo/redo・消去・全消しのときだけ全再描画）と **live**（描画中の1本。`pointermove` ごとに直前の点から `lineTo` で追記）。同じサイズで重ねる。
- `devicePixelRatio` ぶん内部解像度を上げ、`ctx.scale` で論理座標 → デバイスピクセルに変換。
- 座標変換: `getBoundingClientRect()` で CSS px → 論理座標（`x * w / rect.width`）。保存データは端末に依存しない。
- `renderStrokes` はサムネイルでも使う（`scale` だけ変える）。

### 6.3 入力

- Pointer Events のみ（指・ペンタブ・マウスを同じ経路）。`pointerdown` で `setPointerCapture`。`isPrimary` でないポインタ（2本目の指）は無視。
- `getCoalescedEvents()` があれば使い、無ければ単発イベント（Safari 向けフォールバック）。
- canvas に `touch-action: none`、`body` に `overscroll-behavior: none`（描画中のスクロール・引っ張り更新を止める。キャンバスの外は通常どおりスクロール可）。
- `pointerup` でストローク確定: 間引き → `history.push` → 自動保存を予約。`pointercancel` は描きかけを破棄。
- 筆圧は使わない（線幅固定、D-012）。

### 6.4 ツールと履歴

- ペン: 色 黒/赤 × 太さ 3 段階。消しゴム: なぞって離した時点で `strokesHitByEraser` に当たったストロークをまとめて1操作として削除（半径 16 論理単位。実装時に指で狙える大きさに調整）。全消し: 空配列に置換（undo で戻せるので確認なし）。
- 履歴は `strokes` 配列のスナップショット（past / future）。新しい操作で future は捨てる。上限 100。
- 初期データは作品クエリのキャッシュ（`ProjectDetail`）から取る。エディタを開くための追加リクエストはない。

### 6.5 8項目フォーム

- ショットサイズ: セレクト（空を含む）。カメラの動き: 候補チップ（タップで入力欄に入る）＋自由入力欄で1つの文字列。尺: 数値入力（小数可）。他はテキスト（内容・セリフ・備考は複数行）。番号: 1行テキスト、空にはできない（空なら保存せず赤枠）。
- 変更は `useAutosave` を通して 8 項目まとめて `PATCH /api/shots/:id`。番号が空の間は `PATCH` を送らず `unsaved` を表示する（他の項目の変更も番号が入るまで待つ）。

## 7. エラー処理

| 場面 | 振る舞い |
| --- | --- |
| API 401 | `/login?redirect=…` へ。ログイン後に戻る |
| API 400（validation）| 単一ユーザーの UI では原則起きない。起きたら保存状態を `unsaved` にしてコンソールに issues を出す |
| API 404 | 「見つかりません」と作品一覧へのリンク |
| 自動保存の失敗 | 3 回再試行 → `unsaved` 表示。ローカルの値は保持。次の変更で再送 |
| 作品取得の失敗 | TanStack Query の `error` で簡単なメッセージと再読み込みボタン |
| `pointercancel` | 描きかけのストロークを破棄（保存しない） |
| D1 の例外 | Hono の `onError` で 500 `{"error":"internal"}`。ログに出す |

競合制御はしない（単一ユーザー、最後の書き込みが勝つ。D-001 / D-010）。

## 8. ディレクトリと設定（T-009 / T-010）

```
apps/web/
  wrangler.jsonc
  vite.config.ts
  vitest.config.ts
  drizzle.config.ts
  tsconfig.json            src/ + shared/（lib: DOM）
  tsconfig.server.json     server/ + shared/（worker-configuration.d.ts）
  biome.json
  .dev.vars                git 管理外。PASSWORD_HASH / SESSION_SECRET
  drizzle/                 マイグレーション SQL（drizzle-kit generate の出力）
  shared/
    schemas.ts
    sketch/{types,simplify,hitTest,history}.ts ＋ *.test.ts
  server/
    index.ts               export default { fetch }（createApp を env で組み立て）
    app.ts                 createApp(): Hono ルート群。AppType を export
    auth.ts                PBKDF2 照合・Cookie 発行/検証・ミドルウェア
    routes/{projects,scenes,shots}.ts
    db/schema.ts           Drizzle スキーマ
    db/index.ts            drizzle(env.DB, { schema })
    numbering.ts ＋ numbering.test.ts
    *.api.test.ts          API 結合テスト
  src/
    main.tsx  router.tsx  routeTree.gen.ts  styles.css
    routes/…（5.1）
    api/client.ts
    sketch/{render.ts,SketchCanvas.tsx,Toolbar.tsx,SketchThumb.tsx,useSketchEditor.ts}
    components/{ShotCard,ShotGrid,ShotForm,SceneHeader,ProjectDialog,useAutosave}.tsx|.ts
```

### 8.1 wrangler.jsonc

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "storyboard",
  "main": "server/index.ts",
  "compatibility_date": "2025-09-02",
  "assets": {
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  },
  "d1_databases": [
    { "binding": "DB", "database_name": "storyboard", "database_id": "<wrangler d1 create の出力>", "migrations_dir": "drizzle" }
  ]
}
```

- `assets.directory` は書かない（`@cloudflare/vite-plugin` がクライアントのビルド出力を指すよう補う。① 基盤で動作確認する）。
- `/api/*` 以外のリクエストは Worker を経由せず静的アセットから返り、未知のパスは `index.html`（SPA フォールバック）。Worker は `/api/*` だけを受ける。
- `nodejs_compat` は不要（Web Crypto と D1 だけ使う）。

### 8.2 vite.config.ts

```ts
import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [cloudflare(), tanstackRouter({ target: 'react', autoCodeSplitting: true }), viteReact(), tailwindcss()],
})
```

`pnpm dev` で SPA（HMR）と Hono Worker（workerd）とローカル D1 が同時に上がる。`pnpm build` は `dist/client`（SPA）と Worker バンドルを出し、`wrangler deploy` がそれを読む。

### 8.3 vitest.config.ts

2 プロジェクト構成:

- `unit`: `environment: 'node'`、対象 `shared/**/*.test.ts` と `server/**/*.test.ts`（`*.api.test.ts` を除く）。
- `api`: `@cloudflare/vitest-pool-workers` の `defineWorkersProject`。`wrangler.configPath: './wrangler.jsonc'` でローカル D1 バインディングを用意し、`readD1Migrations('./drizzle')` を `miniflare.bindings.TEST_MIGRATIONS` に渡し、`setupFiles` で `applyD1Migrations(env.DB, env.TEST_MIGRATIONS)`。対象 `server/**/*.api.test.ts`。テストは `createApp()` に対して `app.request(path, init, env)` でリクエストを送る（ログインして得た Cookie を付ける）。

### 8.4 drizzle.config.ts

```ts
export default defineConfig({ dialect: 'sqlite', schema: './server/db/schema.ts', out: './drizzle' })
```

マイグレーション適用は drizzle-kit ではなく wrangler で行う（`wrangler d1 migrations apply storyboard --local` / `--remote`）。

### 8.5 package.json スクリプト

| スクリプト | 内容 |
| --- | --- |
| `dev` | `vite dev` |
| `build` | `vite build` |
| `deploy` | `pnpm build && wrangler deploy`（実行前に `db:migrate:remote` を手で流す） |
| `test` | `vitest run` |
| `check` | `biome check && tsc -p tsconfig.json --noEmit && tsc -p tsconfig.server.json --noEmit` |
| `types` | `wrangler types`（`worker-configuration.d.ts` を生成） |
| `db:generate` | `drizzle-kit generate` |
| `db:migrate:local` | `wrangler d1 migrations apply storyboard --local` |
| `db:migrate:remote` | `wrangler d1 migrations apply storyboard --remote` |

### 8.6 依存の入れ替え

- 追加: `hono` `@hono/zod-validator` `zod` `@tanstack/react-query` `@tanstack/router-plugin` `vitest` `@cloudflare/vitest-pool-workers` `@cloudflare/workers-types`（または `wrangler types` の生成物のみ）
- 削除: `@tanstack/react-start` `mysql2` `dotenv` `tsx` `@tanstack/devtools-vite` `@tanstack/react-devtools` `@tanstack/react-router-devtools` `@tanstack/router-cli`、および `src/routes/demo/*` `src/db/*` `src/components/{Header,Footer,ThemeToggle}.tsx`（必要なら作り直す）`.cta.json` `public/drizzle.svg`
- 維持: `react` `react-dom` `@tanstack/react-router` `drizzle-orm` `drizzle-kit` `tailwindcss` `@tailwindcss/vite` `@biomejs/biome` `@cloudflare/vite-plugin` `wrangler` `vite` `@vitejs/plugin-react` `typescript`
- Biome の `files.includes` に `server/**` `shared/**` を加える。

## 9. テスト（T-008）

| 種類 | 対象 | 方法 |
| --- | --- | --- |
| ユニット | `shared/sketch/*`（間引き・当たり判定・履歴）、`server/numbering.ts`（採番・position 振り直し）、`shared/schemas.ts`（境界値） | Vitest `unit` プロジェクト。TDD で書く |
| API 結合 | 認証（login/logout/未認証 401）、作品・シーン・カットの CRUD、並べ替え（不正な ids は 400）、スケッチ upsert、cascade 削除、`GET /api/projects/:id` の形 | Vitest `api` プロジェクト（Worker 内・ローカル D1） |
| 手動 | キャンバスの描き味（スマホの指・PC のペンタブ）、レイアウト、自動保存の体感 | 実機。② スケッチの段階で最初に確認 |

React コンポーネントテスト・ブラウザ E2E は書かない。`pnpm check && pnpm test` をコミット前のゲートにする。

## 10. 実装順序（D-015: 2026-10-14 まで）

| 期限 | 段階 | 内容 | 完了の目安 |
| --- | --- | --- | --- |
| 9/17 | ① 基盤 | スキャフォールド組み直し（8.6）、`wrangler.jsonc` / `vite.config.ts` / tsconfig 2本、Hono `/api/session`、D1 ＋ Drizzle スキーマ ＋ 初回マイグレーション、認証（4.1）、Vitest 2 プロジェクト、`/login` 画面 | `pnpm dev` でログインできる。`pnpm test` が通る。初回 `pnpm deploy` で workers.dev にログイン画面が出る |
| 9/24 | ② スケッチ | `shared/sketch` を TDD で実装、`SketchCanvas` ＋ `Toolbar`、作品・シーン・カットの最小 API（作成・取得）と最小画面（作品一覧・作品ページの骨）、「＋カット → エディタ」動線、スケッチ自動保存 | **スマホの指と PC のペンタブで描いて保存でき、開き直すと続きが描ける** |
| 10/1 | ③ 情報と一覧 | 8項目フォーム（自動保存）、作品ページの PC グリッド / スマホ縦スクロール、`SketchThumb` | 1本ぶんのカットを描いて情報を書き、現場向けにスマホで読み返せる |
| 10/7 | ④ 構成操作 | 作品・シーンの編集・削除、並べ替え（前へ / 後へ、楽観的更新）、番号の手動編集、アスペクト比変更 | 構成の組み替えがアプリ内で完結する |
| 10/14 | ⑤ 仕上げ | 実戦で使いながらの修正の余白 | 自分の1本で使い始められる |

## 11. ① 基盤で確認する事項

設計時点で手元のパッケージ（wrangler 4.131 / @cloudflare/vite-plugin 1.54）と整合を確認済みだが、実装の最初に次を動かして確かめる。

- `@cloudflare/vite-plugin` が `assets.directory` なしでクライアント出力を配信すること（`vite build` → `dist/` に生成される wrangler 設定を確認）。
- `@cloudflare/vitest-pool-workers` が現行の Vite / Vitest と同時に動くこと（動かない場合は Vitest のバージョンを pool 側に合わせる）。
- `run_worker_first: ["/api/*"]` で `/api` 以外が Worker を経由しないこと（ローカル・本番とも）。

## 12. やらないこと（再掲）

R2・PNG サムネイル・画像取り込み（Later で追加）、ユーザーテーブル・複数ユーザー、オフライン・Service Worker、DnD、E2E テスト、CI/CD、ステージング環境、筆圧、部分消し、レイヤー、PDF。
