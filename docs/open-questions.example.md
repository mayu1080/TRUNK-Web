# open-questions（未決事項）— テンプレート

> **使い方**: 本ファイルは Git 管理のテンプレートです。
> ローカル作業用に `docs/open-questions.md` へコピーし、そちらで更新してください。
> `open-questions.md` は `.gitignore` により GitHub へアップロードされません。

```powershell
Copy-Item docs\open-questions.example.md docs\open-questions.md
```

本書は「決めないと実装が進められない」未決を集約します。
回答が得られるまで、実装側は推測で埋めないでください。

## 確定事項（参照用）

| 項目 | 内容 |
|------|------|
| 機能挙動の正 | `docs/Design_Check0622.mp4`（画質は対象外） |
| 4面同期の範囲 | `TOP` → `ANIMATION` → `PRODUCT_LIST` まで |
| TOP → ANIMATION の条件 | **4台すべてが `TOP` のときのみ**4面同期 |
| 1台のみ TOP | 当該台の再開操作は他台を中断しない |
| PRODUCT_LIST 以降 | 各モニター操作は独立 |
| CATEGORY | 独立 screenState ではなく `PRODUCT_LIST` 上の `categoryDrawer` |
| IMAGE_ZOOM | `PRODUCT_LIST` 上の白 overlay。×は常に `PRODUCT_LIST` |
| TRUNK ロゴ | 装飾のみ。タップハンドラなし |
| 無操作タイムアウト | **10分**・当該モニターのみ `TOP`。タップ・スワイプ・ピンチ・スクロールでリセット |

---

## Q1. 4面同期の技術方式（未決）

| # | 質問 |
|---|------|
| 1 | 同期プロトコル（WebSocket / UDP ブロードキャスト / 共有メモリ / その他） |
| 2 | マスター端末の有無（1台主導か、対等か） |
| 3 | 同期遅延の許容値（ms） |
| 4 | 1台障害時の挙動（他3台は継続 / 全体停止 / 自動復帰） |
| 5 | 「全台 TOP」判定の実装方法 |

---

## Q2. 実行環境・ハードウェア（未決）

| # | 質問 |
|---|------|
| 1 | OS / ランタイム |
| 2 | 各モニター解像度・向き・DPI |
| 3 | GPU 要件（60fps 描画） |
| 4 | ネットワーク（オフライン / ローカルLAN） |

---

## Q3. コンテンツ・UI 詳細（未決）

| # | 質問 |
|---|------|
| 1 | `assets/` マニフェスト形式・提供方法 |
| 2 | TOP の「指定箇所タップ」ヒット領域定義 |
| 3 | 詳細画面「4セクション」と `DETAIL_SECTION_1/2` の対応 |
| 4 | 実装スタック（HTML+JS / React / Unity 等） |
