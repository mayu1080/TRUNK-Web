# TRUNK_delivery（納品用実装）

## 概要

4台のタッチモニター向け探索体験（B案：探索デザイン重視型）の**納品用実装**リポジトリです。
本リポジトリは仕様・設計ドキュメントを中心とし、**Electron + Web** による Windows アプリ実装を Phase 1 以降で追加します。

## ランタイム方針（確定）

| 項目 | 内容 |
|------|------|
| UI | Web 技術 |
| シェル | Electron（Windows `.exe`） |
| コンテンツ | 実行ファイル横の外部 `content/`（ビルドに含めない） |
| MVP | サーバー・DB 不要 |

詳細は `docs/architecture.md` / `docs/content-schema.md` / `app/README.md` を参照。

## 現場プレ実機検証（Phase 7）

production app の現場確認は **4 タッチ画面 + 管理画面**。管理画面は Windows / Debug / ログ用で、**5 枚目の production window ではない**。

| 用途 | リンク |
|------|--------|
| 最小手順・起動前 checklist | [`docs/production/phase7-site-preflight.md`](docs/production/phase7-site-preflight.md) |
| 起動後 QA | [`docs/production/phase7-site-qa-checklist.md`](docs/production/phase7-site-qa-checklist.md) |
| 仕様固定メモ（4 面同期 / overlay / 120 秒 idle） | [`docs/production/production-runtime-spec.md`](docs/production/production-runtime-spec.md) |

現場メイン起動: リポジトリ直下 `launch-production.bat`、または `cd app` → `npm run start:production`。preview は 4 面合格の代替にしない。

現場クローンは `LIST_demo` を含まない `feature/production-phase7` を浅く取る（`content/` 実素材は USB）:

```powershell
git clone --single-branch --depth 1 -b feature/production-phase7 https://github.com/mayu1080/TRUNK-Web.git
```

production shell の状態 ID は `AD_IDLE` / `ANIMATION` / `PRODUCT_LIST` + 面ごとの overlay。下記の `TOP` / 10 分 idle は歴史的な function.xlsx 記述であり、現場運用の正ではない。

## 正（Source of Truth）

矛盾時は以下の優先順位で解釈してください。

1. `docs/Design_Check0622.mp4`（**機能挙動の正**。画質は対象外）
2. `docs/function.xlsx`（要件の最新版）
3. `docs/screen-flow.json`（状態ID・遷移・同期ルール）
4. `docs/screen-flow.md`（人間向け説明）
5. `docs/screen-flow.mmd` / `docs/screen-flow.png`（図）
6. `docs/handover.md`（引き継ぎ・受入）

## 画面状態ID（実装・ドキュメント共通）

| 状態ID | 説明 |
|--------|------|
| `TOP` | スリープ画面（4面） |
| `ANIMATION` | 遷移前アニメーション（4面同期） |
| `PRODUCT_LIST` | 暗色探索画面（浮遊画像） |
| `IMAGE_ZOOM` | 探索背景上の白 overlay/card（状態は独立） |
| `PRODUCT_DETAIL` | カテゴリ選択後の白い詳細/カルーセル |

### CATEGORY の扱い

- **CATEGORY** は UX・説明上の名称として使用してよい
- 独立 `screenState` ではなく、`PRODUCT_LIST` 上の右側スライドドロワー
- 実装: `categoryDrawer: open | closed`

### IMAGE_ZOOM の扱い

- `PRODUCT_LIST`（暗色探索背景）上に白い overlay/card として表示
- トリガーは **PRODUCT_LIST 上の画像タップ**
- `screenState: IMAGE_ZOOM` として独立管理してよい
- ×押下時は直前画面へ戻らず、**常に `PRODUCT_LIST` へ遷移**

### TRUNK ロゴ

- 装飾画像のみ。**タップ/クリックハンドラを付けない**
- ロゴタップによる `TOP` 復帰は**廃止**

## 4面同期（確定）

| 範囲 | 挙動 |
|------|------|
| `TOP` → `ANIMATION` → `PRODUCT_LIST` | 4面同期 |
| `TOP` → `ANIMATION` の条件 | **4台すべてが `TOP` のときのみ** |
| 1台のみ `TOP` | 無操作タイムアウト等で当該台だけ `TOP` の場合、再開は他台を中断しない |
| `PRODUCT_LIST` 以降 | 各モニター操作は独立（同時に別ユーザーが探索可能） |

## 無操作タイムアウト（確定）

- **10分**無操作で、**当該モニターのみ** `TOP` へ復帰
- **タップ・スワイプ・ピンチ・スクロール**は操作とみなし、タイムアウトカウントを再スタート
- 他モニターには影響しない

## 廃止仕様・Git履歴参照禁止

以下は**実装・設計に含めない**でください。

| 項目 | 理由 |
|------|------|
| `FESTIVAL`（祝祭演出） | `function.xlsx` から削除済み |
| 旧 `TOP_1`〜`TOP_4` / `EXPLORE` / `DETAIL` 等の独立状態 | 現行ID体系に統一済み |
| `CATEGORY` を独立 screenState とする設計 | `categoryDrawer` に統一 |
| TRUNK ロゴタップ → `TOP` | **廃止**（装飾のみ） |
| `PRODUCT_DETAIL` から `IMAGE_ZOOM` | **廃止**（`PRODUCT_LIST` 画像タップが正） |

**Git 履歴（旧コミットの `index.html` / `setup/` 等）を参照して仕様を復元しないでください。**
仕様根拠は現行 `docs/` のみとします。

## ドキュメント一覧

| ファイル | 用途 |
|----------|------|
| `docs/production/phase7-site-preflight.md` | 現場起動前 checklist・monitor-layout・troubleshooting |
| `docs/production/phase7-site-qa-checklist.md` | 現場起動後 QA |
| `docs/production/production-runtime-spec.md` | production 起動コマンドと runtime 仕様 |
| `docs/handover.md` | 引き継ぎ・受入チェックリスト |
| `docs/open-questions.example.md` | 未決事項テンプレ（Git 管理） |
| `docs/architecture.md` | 実施設計（Electron / content / 責務分担） |
| `docs/content-schema.md` | 外部 `content/` JSON スキーマ |
| `docs/security.md` | セキュリティ設計（実装と並行して更新） |

### ローカル専用ファイル（Git 管理外）

| ファイル | 用途 |
|----------|------|
| `docs/open-questions.md` | 未決事項の作業用。**GitHub にはアップロードしない**。初回は `open-questions.example.md` をコピー |

## 外注向け成果物

- `docs/architecture.md` … 実施設計（同期方式、コンポーネント、状態管理、性能）
- `docs/security.md` … セキュリティ設計（脅威モデル、端末ハードニング、更新）

## 未決事項

ローカル作業用の `docs/open-questions.md` を参照してください（**Git 管理外**）。
リポジトリにはテンプレ `docs/open-questions.example.md` のみ含まれます。回答前に推測で実装しないでください。

## コミット禁止物

- `.env` / 認証情報
- 顧客未公開の実メディア（大量画像・動画）
- 仕様の独断変更（`function.xlsx` / `screen-flow.*` の更新は発注者承認後）
