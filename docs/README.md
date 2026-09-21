# docs

このプロジェクト（絵コンテ管理アプリ）のドキュメント置き場。

## product/ — プロダクトの方向性

- [overview.md](./product/overview.md) — **まずここ**。誰のため・何を解く・MVP スコープ・制約を1ページに集約。
- [decisions.md](./product/decisions.md) — 決定事項ログ。ヒアリングで決めたことを D-001 から順に、背景と含意つきで記録。決定が覆った履歴も残す。

## tech/ — 技術決定

- [decisions.md](./tech/decisions.md) — 技術決定事項ログ。アーキテクチャ・DB・認証などを T-001 から順に、背景と含意つきで記録。

## superpowers/ — 設計書・実装計画（git 管理外）

- `superpowers/specs/` の設計書と `superpowers/plans/` の実装計画は superpowers（Claude Code のスキル）の生成物として `.gitignore` で git 管理外にしている。手元にだけ置く。
- リポジトリに残す正式な記録は `product/decisions.md` と `tech/decisions.md`（設計書は T-001〜T-011 を統合したもの）。

## 運用ルール

- 方向性に関わる決定は `product/decisions.md` に追記し、`overview.md` を追従させる。
- 技術に関わる決定は `tech/decisions.md` に追記し、設計書（`superpowers/specs/`、git 管理外）を追従させる。
