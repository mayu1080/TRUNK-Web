# TRUNK_delivery（納品用実装）

## 概要

4台のタッチモニター向け探索体験（B案：探索デザイン重視型）の**納品用実装**リポジトリです。
本リポジトリは仕様・設計ドキュメントを中心とし、実装コードはこれから追加されます。

## 正（Source of Truth）

矛盾時は以下の優先順位で解釈してください。

1. `docs/function.xlsx`（要件の最新版）
2. `docs/screen-flow.json`（状態ID・遷移・同期ルール）
3. `docs/screen-flow.md`（人間向け説明）
4. `docs/screen-flow.mmd` / `docs/screen-flow.png`（図）
5. `docs/handover.md`（引き継ぎ・受入）

## 画面状態ID（実装・ドキュメント共通）

| 状態ID | 説明 |
|--------|------|
| `TOP` | スリープ画面（4面） |
| `ANIMATION` | 遷移前アニメーション（4面同期） |
| `PRODUCT_LIST` | 探索画面（商品探索一覧） |
| `PRODUCT_DETAIL` | 詳細画面 |
| `IMAGE_ZOOM` | 画像拡大（overlay UI、状態は独立） |

### CATEGORY の扱い

- **CATEGORY** は UX・説明上の名称として使用してよい
- 独立 `screenState` ではなく、`PRODUCT_LIST` 上の右側スライドドロワー
- 実装: `categoryDrawer: open | closed`

### IMAGE_ZOOM の扱い

- `PRODUCT_DETAIL` 上に overlay 表示（見た目はモーダル）
- `screenState: IMAGE_ZOOM` として独立管理してよい
- ×押下時は直前画面へ戻らず、**常に `PRODUCT_LIST` へ遷移**

## 4面同期（確定）

| 範囲 | 挙動 |
|------|------|
| `TOP` → `ANIMATION` → `PRODUCT_LIST` | 4面同期必須 |
| `PRODUCT_LIST` 以降 | 各モニター操作は独立（同時に別ユーザーが探索可能） |

## 廃止仕様・Git履歴参照禁止

以下は**実装・設計に含めない**でください。

| 項目 | 理由 |
|------|------|
| `FESTIVAL`（祝祭演出） | `function.xlsx` から削除済み |
| 旧 `TOP_1`〜`TOP_4` / `EXPLORE` / `DETAIL` 等の独立状態 | 現行ID体系に統一済み |
| `CATEGORY` を独立 screenState とする設計 | `categoryDrawer` に統一 |

**Git 履歴（旧コミットの `index.html` / `setup/` 等）を参照して仕様を復元しないでください。**
仕様根拠は現行 `docs/` のみとします。

## ドキュメント一覧

| ファイル | 用途 |
|----------|------|
| `docs/handover.md` | 引き継ぎ・受入チェックリスト |
| `docs/open-questions.md` | 未決事項 |
| `docs/architecture.md` | 実施設計（外注作成・更新） |
| `docs/security.md` | セキュリティ設計（外注作成・更新） |

## 外注向け成果物

- `docs/architecture.md` … 実施設計（同期方式、コンポーネント、状態管理、性能）
- `docs/security.md` … セキュリティ設計（脅威モデル、端末ハードニング、更新）

## 未決事項

`docs/open-questions.md` を参照し、回答前に推測で実装しないでください。

## コミット禁止物

- `.env` / 認証情報
- 顧客未公開の実メディア（大量画像・動画）
- 仕様の独断変更（`function.xlsx` / `screen-flow.*` の更新は発注者承認後）
