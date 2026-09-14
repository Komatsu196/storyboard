# 技術決定事項ログ

絵コンテ管理アプリの技術設計（アーキテクチャ・DB・API・認証など）に関する決定事項を、設計ヒアリングの進行順に記録する。プロダクトの方向性は [product/decisions.md](../product/decisions.md)（D-xxx）を参照。

- 番号は決定順（T-001, T-002, ...）。
- 決定が覆った場合は元の項目の「状態」を「取り消し（→T-xxx）」に、一部だけ変わった場合は「一部修正（→T-xxx）」に変え、新しい番号で追記する（履歴は消さない）。
- 各項目は「決定 / 背景 / 含意（この決定から導かれること）」で書く。
- 決定が出揃ったら `docs/superpowers/specs/` の設計書に統合する。

## 一覧

| #     | 決定事項                                                   | 状態 | 日付       |
| ----- | ---------------------------------------------------------- | ---- | ---------- |
| T-001 | SPA と API を1つの Cloudflare Worker に同居させる（Static Assets ＋ Hono） | 決定 | 2026-09-14 |
| T-002 | DB は Cloudflare D1（SQLite）＋ Drizzle ORM                        | 決定 | 2026-09-14 |
| T-003 | スケッチはストローク JSON のみ保存。サムネイルはクライアントで描画（PNG・R2 は使わない） | 決定 | 2026-09-14 |
| T-004 | 認証はアプリ内パスワード＋HMAC 署名付き HttpOnly Cookie                 | 決定 | 2026-09-14 |
| T-005 | API は Hono ＋ zod、クライアントは Hono RPC（hono/client）＋ TanStack Query | 決定 | 2026-09-14 |
| T-006 | 消しゴムはストローク単位（一筆ごと消す）。キャンバスは Canvas 2D ＋ Pointer Events で自作 | 決定 | 2026-09-14 |
| T-007 | 並べ替えは「前へ / 後へ」ボタン。DnD ライブラリは入れない                | 決定 | 2026-09-14 |
| T-008 | テストは Vitest で「純粋ロジックのユニット」＋「API の結合（vitest-pool-workers）」。E2E・コンポーネントテストはなし | 決定 | 2026-09-14 |
| T-009 | ローカル開発は @cloudflare/vite-plugin の `vite dev` 一本、デプロイは手動。CI なし | 決定 | 2026-09-14 |
| T-010 | リポジトリは apps/web の1パッケージ。src/（SPA）server/（Hono）shared/（共有）に分ける | 決定 | 2026-09-14 |
| T-011 | スケッチもカット情報も同じ自動保存（デバウンス＋離脱時 flush）。保存ボタンは置かない | 決定 | 2026-09-14 |

---

## T-001: SPA と API を1つの Cloudflare Worker に同居させる（Static Assets ＋ Hono）

- **決定**: フロント（Vite + React + TanStack Router の SPA）は Workers Static Assets として `dist/client` から配信し、`/api/*` だけを同じ Worker 上の Hono が処理する。Worker は1つ、デプロイも1回。
- **背景**: 技術設計 Q1「SPA と API をどう配置するか」への回答。選択肢は「1つの Worker に同居 / SPA と API を別 Worker に分離 / Cloudflare Pages ＋ Pages Functions」。個人利用・無料枠（D-014）の前提では分離の利点が薄く、Pages は Cloudflare 自身が Workers への統合を進めているため、同居を選んだ。
- **含意**:
  - 同一オリジンなので CORS 設定が不要で、認証は HttpOnly Cookie が素直に使える（認証方式は別途決定）。
  - `wrangler.jsonc` の `assets` に `not_found_handling: "single-page-application"` と `run_worker_first: ["/api/*"]` を設定し、SPA のルーティングは静的側、API だけ Worker 側で受ける。
  - 静的アセットの配信は無料枠で回数制限なし。Worker の起動は API 呼び出しのときだけなので、無料枠（10万リクエスト/日）に十分収まる。
  - 現在の `apps/web` は TanStack Start 前提（`main: "@tanstack/react-start/server-entry"`）なので、Worker のエントリを Hono に組み直す。

## T-002: DB は Cloudflare D1（SQLite）＋ Drizzle ORM

- **決定**: 作品・シーン・カットの構造化データは Cloudflare D1 に保存し、Drizzle ORM（`drizzle-orm/d1`）でアクセスする。マイグレーションは `drizzle-kit generate` で SQL を生成し、`wrangler d1 migrations apply` で適用する。
- **背景**: 技術設計 Q2「作品・シーン・カットのデータはどこに保存するか」への回答。選択肢は「D1 ＋ Drizzle / Durable Objects（SQLite ストレージ）/ 外部 DB（Turso・Neon など）」。作品→シーン→カットの階層と並べ替えはリレーショナルが素直で、Cloudflare 内で完結し、無料枠（5GB・読み 500 万行/日・書き 10 万行/日）に余裕があるため D1 を選んだ。D-014 で D1 が候補として挙がっていた。
- **含意**:
  - スキャフォールドの Drizzle 設定（`dialect: 'mysql'`、`mysql2`）を SQLite/D1 向けに切り替える。`mysql2` は削除。
  - ローカル開発は wrangler（miniflare）のローカル SQLite で D1 を模擬でき、本番と同じコードパスで動かせる。
  - スケッチのストローク情報を D1 に置くか別ストレージに置くかは別途決める（T-003）。
  - 本番 DB は1つ（ステージング環境は作らない。個人利用・D-006）。

## T-003: スケッチはストローク JSON のみ保存。サムネイルはクライアントで描画（PNG・R2 は使わない）

- **決定**: スケッチの正データは「ストローク情報（色・太さ・点列）の JSON」とし、D1 に保存する。一覧（PC グリッド）・閲覧（スマホ縦スクロール）のサムネイルは、エディタと同じ描画関数でブラウザがストロークから描く。PNG の生成・保存・配信、および R2 は MVP では使わない。
- **背景**: 技術設計 Q3「サムネイルをどう扱うか」への回答。選択肢は「ストローク JSON だけ保存しクライアント描画 / JSON を D1・PNG を R2 / JSON も PNG も D1」。D-013 の「あとから追記・消去できる」要件でストローク保存は必須であり、そのうえで PNG を別に持つとバイナリ処理・R2・キャッシュ無効化が増える。ラフなスケッチ（D-005）なら gzip 後の JSON は PNG と同程度のサイズに収まるため、D-006 に従い最小構成を選んだ。
- **含意**:
  - ストレージは D1 のみ。`wrangler.jsonc` のバインディングは D1 ひとつで済む。
  - 描画関数（ストローク配列 → Canvas 2D）を1つ作り、エディタ・サムネイル・閲覧の3箇所で共有する。サムネイルは常に最新かつ端末解像度に応じて鮮明。
  - JSON を小さく保つため、保存時に点列を間引く（一定距離未満の点を捨てる）。座標は作品のアスペクト比ごとに固定した論理座標系（端末非依存）で持つ。
  - ストローク JSON はカット行と分け、`sketches` テーブル（shot_id を主キー）に置く。カット一覧のクエリがストロークを引きずらないようにする。
  - 作品を開くときはストロークを含めて一括取得する想定（100カット規模で数百 KB〜1MB 程度）。想定より重くなった場合は、シーン単位の取得に切り替える余地を残す。
  - Later の画像取り込み（D-013）を実装する時点で R2 とサムネイル PNG を追加する。そのときストロークの保存形式は変えない。

## T-004: 認証はアプリ内パスワード＋HMAC 署名付き HttpOnly Cookie

- **決定**: 単一ユーザー向けのパスワード認証をアプリ内に実装する。Worker の Secret にパスワードのハッシュと署名鍵を置き、`POST /api/login` で照合に成功したら有効期限付きの HMAC 署名 Cookie（HttpOnly / Secure / SameSite=Lax、90 日程度）を発行する。`/api/*` は Hono のミドルウェアで Cookie を検証し、未認証は 401 を返す。外部 ID プロバイダや Cloudflare Access は使わない。
- **背景**: 技術設計 Q4「自分だけが使えるログインをどう実現するか」への回答。選択肢は「アプリ内パスワード＋署名付き Cookie / Cloudflare Access / パスキー」。Access はコードゼロだがローカル開発でコードパスが変わり設定がリポジトリ外に残る、パスキーは MVP には過剰、という理由で最小のアプリ内実装を選んだ（D-001, D-006）。
- **含意**:
  - ユーザーテーブルは作らない。「ログイン済みか」だけを扱い、ユーザー ID の概念はデータモデルに持ち込まない（複数ユーザー化は D-001 で対象外）。
  - パスワード照合はハッシュ（PBKDF2、Web Crypto で実装可）に対して行い、比較はタイミング安全にする。Secret 名: `PASSWORD_HASH`（またはソルト込みの1文字列）、`SESSION_SECRET`。
  - SPA 側は 401 を受けたらログイン画面へ遷移する。ログイン画面はパスワード欄1つだけ。ログアウトは Cookie を消す `POST /api/logout`。
  - ローカル開発では `.dev.vars` に同じ Secret を置き、本番と同じコードで動かす。
  - T-001（同一オリジン）により CSRF 対策は SameSite=Lax と「状態変更は JSON ボディの POST/PUT/DELETE のみ」で足りる。

## T-005: API は Hono ＋ zod、クライアントは Hono RPC（hono/client）＋ TanStack Query

- **決定**: Worker 側の API は Hono で書き、リクエストの検証は `@hono/zod-validator` ＋ zod で行う。SPA 側は `hc<AppType>()`（Hono RPC）でパス・入出力の型をそのまま参照し、サーバー状態の取得・キャッシュ・更新は TanStack Query で扱う。tRPC は使わない。
- **背景**: 技術設計 Q5「SPA ↔ Worker 間の通信と型共有をどうするか」への回答。選択肢は「Hono RPC ＋ zod / tRPC / 素の fetch ＋ 共有型定義」。同一パッケージ内（T-001）で AppType を import できるため、追加ライブラリが zod だけで端から端まで型が通る Hono RPC を選んだ。
- **含意**:
  - API は素の JSON REST（`GET /api/projects/:id` など）なので、curl やブラウザでも確認できる。
  - zod スキーマは「ショットサイズ・カメラの動きの選択肢（D-007）」「アスペクト比（D-013）」などの固定リストの唯一の定義場所にし、クライアントの選択肢 UI もそこから生成する。
  - TanStack Query のキャッシュ単位は「作品1件（シーン・カット・スケッチを含む）」を基本にし、更新後は該当作品のクエリを無効化する（楽観的更新は並べ替えなど体感が必要な箇所だけ）。
  - TanStack Router のローダーは Query の `ensureQueryData` を呼ぶ薄い層にとどめる。

## T-006: 消しゴムはストローク単位（一筆ごと消す）。キャンバスは Canvas 2D ＋ Pointer Events で自作

- **決定**: 消しゴムは「なぞった線を一筆ごと消す」オブジェクト消しゴムにする。点単位の部分消し・白ペンによる上書きはしない。キャンバスは HTML Canvas 2D と Pointer Events で自作し、描画ライブラリ（tldraw / excalidraw / fabric 等）は使わない。
- **背景**: 技術設計 Q6「消しゴムの手触り」への回答。選択肢は「ストローク単位 / 点単位で削る（分割）/ 白いペンで上書き」。ストローク JSON を正データにする T-003 と最も自然に噛み合い、当たり判定と undo/redo が単純。ラフな線は描き直す方が早い（D-005, D-011）という前提に立つ。
- **含意**:
  - 消しゴムの当たり判定は「消しゴムの軌跡の各点から一定距離内にストロークの点があるか」で行う。太さは1種類（画面上で指で狙える程度）。
  - undo/redo は「ストローク配列のスナップショット履歴」で実装する（描く＝末尾に追加、消す＝該当要素を除去、全消し＝空配列）。ピクセル状態を持たないので履歴が軽い。
  - 描画中はページのスクロール・ズームを止める（キャンバスに `touch-action: none`、`setPointerCapture`）。指（touch）とペンタブ（pen）はどちらも Pointer Events で同じ処理。筆圧は使わず線幅は固定（D-012）。
  - 部分消しが欲しくなった場合は、ストロークを分割する消しゴムに差し替えられる（データ形式は変えずに済む）。

## T-007: 並べ替えは「前へ / 後へ」ボタン。DnD ライブラリは入れない

- **決定**: シーン・カットの並べ替えは、各項目のメニューにある「前へ移動 / 後へ移動」ボタンで行う。PC・スマホとも同じ操作。ドラッグ&ドロップ（dnd-kit 等）は MVP では入れない。
- **背景**: 技術設計 Q7「並べ替えをどう操作させるか」への回答。選択肢は「前へ/後へボタンだけ / PC は DnD・スマホはボタン / 両方 DnD」。絵コンテの並べ替えは隣接入れ替えが大半で、ライブラリ・ドラッグ判定・スクロール干渉を避けられる最小案を選んだ（D-006, D-015）。
- **含意**:
  - 並び順は兄弟内の整数 `position` 列で持つ。並べ替え API は「兄弟の ID を並び順どおりに全部送る」`PUT .../order` の1本にし、サーバーは受け取った順で position を振り直す。ボタン操作でも将来の DnD でも API は同じ。
  - 並べ替えは体感が重要なので TanStack Query の楽観的更新を使う（失敗時は元に戻して再取得）。
  - 番号（シーン番号・カット番号）は並べ替えで自動的には振り直さない。D-007「自動採番＋手動調整」に従い、作成時に自動で付け、あとは手で直す。振り直しボタンは Later 候補。

## T-008: テストは Vitest で「純粋ロジックのユニット」＋「API の結合（vitest-pool-workers）」。E2E・コンポーネントテストはなし

- **決定**: 自動テストは2種類に絞る。①キャンバスと採番・並べ替えの純粋ロジック（点の間引き、消しゴムの当たり判定、undo/redo 履歴、自動採番、position の振り直し）のユニットテスト。②Hono API の結合テスト。後者は `@cloudflare/vitest-pool-workers` でテストを Worker ランタイム内で実行し、ローカル D1（マイグレーション適用済み）に対して実際のリクエストを流す。React コンポーネントテストとブラウザ E2E は書かず、画面は手で確認する。
- **背景**: 技術設計 Q8「どこまで自動テストを書くか」への回答。選択肢は「ユニット＋API 結合 / ＋主要動線の E2E / ユニットのみ」。TDD で進める前提のもと、壊れると痛い部分（データ・API・幾何ロジック）を自動化し、Canvas の描き味は自動化コストに見合わないため手で確認する（D-015）。
- **含意**:
  - 描画関連のロジックは Canvas / DOM に依存しない純粋関数として `sketch/` に切り出す（描画関数だけが `CanvasRenderingContext2D` を受け取る）。
  - API 結合テストのため、DB アクセスは `env.DB` を引数で受ける形にし、テストからも本番からも同じ Hono アプリを `app.request()` で叩ける構造にする。
  - Vitest の設定は2プロジェクト（`node` 環境のユニット / `workers` プールの API）に分ける。
  - `pnpm test` を CI 相当のゲートとして、コミット前に通す。

## T-009: ローカル開発は @cloudflare/vite-plugin の `vite dev` 一本、デプロイは手動。CI なし

- **決定**: ローカル開発は `@cloudflare/vite-plugin` を使い、`pnpm dev` ひとつで SPA（HMR）と Hono Worker（workerd 上）とローカル D1 を同時に動かす。本番反映は `pnpm deploy`（`vite build` → `wrangler deploy`）を手で実行し、その前に `wrangler d1 migrations apply --remote` を手で流す。GitHub Actions などの CI/CD は作らない。公開 URL は `*.workers.dev`。
- **背景**: 技術設計 Q9「ローカル開発とデプロイをどう回すか」への回答。選択肢は「vite dev 一本＋手動デプロイ / ＋GitHub Actions 自動デプロイ / vite dev と wrangler dev を別プロセス」。ソロ開発で月に数回のデプロイなら手動で足り、トークン管理とワークフロー保守を持ち込まない（D-006）。
- **含意**:
  - `wrangler.jsonc` の `main` を Hono のエントリ（`server/index.ts`）に、`assets` を SPA のビルド出力に向ける。スキャフォールドの TanStack Start 用設定は捨てる。
  - `package.json` のスクリプトは `dev / build / deploy / test / check / db:generate / db:migrate:local / db:migrate:remote` 程度に絞る。
  - 環境は「ローカル（`.dev.vars`＋ローカル D1）」と「本番」の2つだけ。ステージングは作らない。
  - 本番の Secret（T-004）は `wrangler secret put` で一度だけ登録する。

## T-010: リポジトリは apps/web の1パッケージ。src/（SPA）server/（Hono）shared/（共有）に分ける

- **決定**: 現在の pnpm workspace と `apps/web` パッケージを維持し、その中を次の3つに分ける。
  - `src/` — SPA（Vite の root。React・TanStack Router・TanStack Query・Canvas エディタ）
  - `server/` — Hono Worker（ルート・認証ミドルウェア・Drizzle スキーマとクエリ）
  - `shared/` — SPA と Worker の両方から import する、DOM にも Workers API にも依存しないコード（zod スキーマ、固定の選択肢、スケッチの幾何ロジック）
  パッケージ分割（apps/api・packages/shared）や、workspace の廃止はしない。
- **背景**: 技術設計 Q10「SPA・Worker・共有コードをどう置くか」への回答。選択肢は「1パッケージ内で分ける / workspace で3パッケージに分割 / 平坦化」。T-001（同居デプロイ）と T-005（hono/client の型参照）が1つの wrangler.jsonc・1つの tsconfig 群でそのまま成立し、ソロ開発で境界を増やすコストが見合わないため。
- **含意**:
  - tsconfig は `tsconfig.json`（`src/`＋`shared/`、lib: DOM）と `tsconfig.server.json`（`server/`＋`shared/`、`wrangler types` が生成する Worker 型）の2つ。`shared/` は両方でコンパイルされるので DOM・Workers 固有 API を使わない。
  - Biome の対象に `server/` と `shared/` を加える。
  - 既存の `src/routes/demo/*`、`src/db/*`（MySQL 用）、`server-entry` 前提の設定は削除し、Drizzle スキーマは `server/db/` に移す。

## T-011: スケッチもカット情報も同じ自動保存（デバウンス＋離脱時 flush）。保存ボタンは置かない

- **決定**: カット編集画面では、スケッチ（`PUT /api/shots/:id/sketch`）もカット情報8項目（`PATCH /api/shots/:id`、8項目をまとめて1リクエスト）も同じ `useAutosave` フックで自動保存する。変更後一定時間（スケッチ 800ms、項目 1.5s）で送信し、フォーカスが外れたとき・画面を離れるとき・タブが隠れたときは即時 flush（`fetch` の `keepalive`）。保存ボタンと「未保存で離れますか？」の警告は置かない。
- **背景**: 設計 §3 のレビューで「テキストはコスパを意識して保存ボタンで登録/更新が良いのでは」という問いがあった。無料枠（Workers 10 万リクエスト/日、D1 10 万行書き込み/日）に対し1人の編集は 1% にも届かないためコストは判断軸にならず、「スマホの空き時間入力で押し忘れない」「仕組みが1つで済む」ことを優先して自動保存に統一した。当初案の「項目ごとに blur で PATCH」は取り下げた。
- **含意**:
  - 保存状態の表示（保存済み / 保存中 / 未保存）と再試行（指数バックオフ 3 回、失敗してもローカルの値は捨てない）はフックに集約し、スケッチ・項目で共有する。
  - 項目の PATCH は「変更のあった項目だけ」でなく8項目まとめて送ってよい（サーバーはそのまま上書き。単一ユーザーなので競合しない）。
  - 保存に失敗したまま画面を離れた場合は入力が失われうる。単一ユーザー・常時オンライン（D-010）の前提で許容する。
