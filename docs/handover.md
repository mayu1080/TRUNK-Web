# 引き継ぎ書（納品用実装）

| 項目 | 内容 |
|------|------|
| 版 | 1.0 |
| 作成日 | 2026-05-27 |
| 対象フェーズ | 納品用実装（試作コードはリポジトリから除去済み） |
| 想定読者 | 実装担当 / 検収担当 / 運用担当 |

---

## 1. ドキュメント情報

### 用語集

| 用語 | 意味 |
|------|------|
| 画面状態ID | 実装で保持する `screenState` の値（例: `PRODUCT_LIST`） |
| scrollSection | `PRODUCT_DETAIL` 内の表示位置（例: `DETAIL_SECTION_1`） |
| 4面同期 | 4台のタッチモニターが同一タイミングで同じ画面・アニメーションを表示すること |
| 正（Source of Truth） | 矛盾時に優先するドキュメント。本プロジェクトでは `function.xlsx` が最上位 |

---

## 2. プロジェクト概要

### 目的

白黒グレースケールの画像空間を探索し、カテゴリ・商品詳細・画像拡大へ遷移するキオスク型インタラクティブ体験（B案：探索デザイン重視型）の**納品用実装**。

### 納品範囲（本リポジトリ時点）

| 含む | 含まない（現状） |
|------|------------------|
| 画面遷移・要件定義（`docs/`） | アプリケーション実装コード |
| 要件一覧（`function.xlsx`） | メディアアセット本体（`assets/` はプレースホルダのみ） |
| 引き継ぎ・画面遷移仕様 | キオスク起動スクリプト（過去コミットに存在、現 HEAD では削除） |

### 試作からの位置づけ

- コミット `a242758`（納品用データ作成開始）で `index.html` / `README.md` / `setup/` を削除し、仕様中心の構成へ整理。
- 削除前の `index.html` は「バブルによるカラー露出＋仮想空間パン/ズーム」の**体験試作（L1）**であり、画面遷移の状態管理は未整備。
- 納品実装では **`docs/function.xlsx` と `docs/screen-flow.*` を正**とし、試作ロジックの有無に関わらず要件どおりに再実装する。

---

## 3. リポジトリ現状

### ディレクトリ構成（2026-05-27 時点）

```
TRUNK_delivery/
├── .gitignore
├── assets/
│   └── .gitkeep          # メディア配置用（未同梱）
└── docs/
    ├── function.xlsx     # 要件最新版（正）
    ├── screen-flow.json  # 画面状態・遷移（機械可読）
    ├── screen-flow.md    # 画面遷移（人間向け）
    ├── screen-flow.mmd   # Mermaid ソース
    ├── screen-flow.png   # 画面遷移図（screen-flow.mmd から生成）
    └── handover.md       # 本書
```

### 各ファイルの役割

| ファイル | 役割 |
|----------|------|
| `function.xlsx` | MUST/SHOULD 要件一覧（最新） |
| `screen-flow.json` | 画面状態ID・遷移・同期ルールの定義 |
| `screen-flow.md` | 画面遷移の説明・要件抜粋 |
| `screen-flow.mmd` | 図のソース（エディタ / Mermaid 対応ツールでレンダリング） |
| `screen-flow.png` | 画面遷移図（PNG）。`screen-flow.mmd` を正として生成 |
| `assets/.gitkeep` | 画像・動画の配置先プレースホルダ |

### 削除済み資産（Git 参照）

| パス | 参照コマンド例 | 備考 |
|------|----------------|------|
| `index.html` | `git show a242758^:index.html` | 探索体験試作 |
| `README.md` | `git show a242758^:README.md` | 試作説明 |
| `setup/` | `git show f97e996:setup/README.md` | キオスク・受入メモ |

### メディア・Git 方針

- `.gitignore` で `*.mp4` を除外。大容量メディアはリポジトリ外管理を想定。
- 実装時は `assets/` 配下にマニフェストを置く構成を推奨（詳細は実装着手時に合意）。

---

## 4. 仕様の正（Source of Truth）

### 優先順位

1. **`docs/function.xlsx`**（要件の最新版）
2. **`docs/screen-flow.json`**
3. **`docs/screen-flow.md`**
4. **`docs/screen-flow.mmd`**

### 旧データについて

- 旧 `screenflow.md` / `screenflow.json` は **廃止**（`TOP_1`〜`TOP_4`, `EXPLORE`, `DETAIL` 等のID体系）。
- 本引き継ぎ以降、フォルダ内の共通呼び名は **`screen-flow.*` + 本書の状態ID** に統一する。

### function.xlsx の位置づけ

- シート: `MUSTSHOULD要件一覧_2`
- 列: 画面 / カテゴリ / 要件内容
- 画面遷移の網羅的定義は xlsx 単体ではなく、`screen-flow.json` が補完する（遷移・同期・scrollSection）。

---

## 5. 機能要件（必須）

### 5.1 4画面同期（納品合意・xlsx 外明示）

| ID | 内容 |
|----|------|
| MULTI_MONITOR_TOUCH_SYNC | 4台のいずれかで有効タッチ → 4台すべて同一遷移（`TOP` から `ANIMATION`） |
| MULTI_MONITOR_ANIMATION_SYNC | `ANIMATION` は4面同期再生が必須 |

### 5.2 画面状態モデル

基本状態（`screenState`）:

| 状態ID | 画面名 | 備考 |
|--------|--------|------|
| `TOP` | スリープ画面 | panel 1〜4 |
| `ANIMATION` | アニメーション_1 | 4面同期 |
| `PRODUCT_LIST` | 探索画面 | 商品探索一覧 |
| `CATEGORY` | カテゴリ画面 | |
| `PRODUCT_DETAIL` | 詳細画面 | scrollSection 併用 |
| `IMAGE_ZOOM` | 画像拡大 | モーダル |

`PRODUCT_DETAIL` 専用（`scrollSection`）:

| 値 | 表示名 |
|----|--------|
| `DETAIL_SECTION_1` | 詳細画面-1 |
| `DETAIL_SECTION_2` | 詳細画面-2 |

※ 詳細-1 / 詳細-2 は**別画面ではない**。同一 `PRODUCT_DETAIL` 内のスクロール位置として扱う。

### 5.3 旧IDからの対応（参考）

| 旧（screenflow） | 新（統一ID） |
|------------------|--------------|
| `TOP_1`〜`TOP_4` | `TOP` + `panelIndex` 1〜4 |
| `ANIMATION_1` | `ANIMATION` |
| `EXPLORE` | `PRODUCT_LIST` |
| `DETAIL` | `PRODUCT_DETAIL` |
| `IMAGE_ZOOM` | `IMAGE_ZOOM`（変更なし） |
| `FESTIVAL` | **廃止**（function.xlsx から削除） |
| `CATEGORY` | `CATEGORY`（変更なし） |

---

## 6. 画面遷移仕様（詳細）

詳細は `screen-flow.md` / `screen-flow.json` を参照。概要のみ記載。

### 遷移一覧

| from | to | trigger |
|------|-----|---------|
| TOP | ANIMATION | 指定箇所タップ（4面同期） |
| ANIMATION | PRODUCT_LIST | アニメーション終了 |
| PRODUCT_LIST | IMAGE_ZOOM | 画像タップ |
| IMAGE_ZOOM | PRODUCT_LIST | ×ボタン |
| PRODUCT_LIST | CATEGORY | ハンバーガーメニュー |
| CATEGORY | PRODUCT_LIST | ×ボタン |
| CATEGORY | PRODUCT_DETAIL | カテゴリ選択 |
| PRODUCT_DETAIL | CATEGORY | ×ボタン |
| PRODUCT_LIST / CATEGORY / PRODUCT_DETAIL / IMAGE_ZOOM | TOP | TRUNKロゴタップ |

### 旧仕様からの変更点

| 項目 | 旧 screenflow | 新（function.xlsx 準拠） |
|------|---------------|-------------------------|
| 無操作スリープ復帰 | 一定時間で `TOP_1` | **xlsx に記載なし → 実装対象外（要否は別途合意）** |
| 画像拡大の戻り先 | 探索画面 | `PRODUCT_LIST`（同一） |
| ロゴタップで TOP 復帰 | 旧 README に近い運用 | **xlsx「共通UI」として明記** |
| 祝祭演出（FESTIVAL） | ダブルタップ導線あり | **廃止**（function.xlsx から削除） |

---

## 7. 未確定・要確認事項

| # | 項目 | 現状 |
|---|------|------|
| 1 | 4面同期の技術方式 | 未決（WebSocket / ローカルブロードキャスト / 専用ミドルウェア等） |
| 2 | 無操作タイムアウトで TOP 復帰 | xlsx になし。必要なら要件追加 |
| 3 | 実装スタック | 未決（HTML+JS / React / Unity / TouchDesigner 等） |
| 4 | `screen-flow.png` の再生成 | mmd 変更時は `npx @mermaid-js/mermaid-cli` 等で更新 |
| 5 | メディアマニフェスト形式 | 未作成 |
| 6 | 詳細画面「4セクション」と DETAIL_SECTION_1/2 の対応 | スクロール上の2区分を SECTION_1/2 とし、残り2区分は実装時レイアウト定義 |

---

## 8. 実装方針（推奨）

### 状態管理（最小）

```text
{
  screenState: 'TOP' | 'ANIMATION' | 'PRODUCT_LIST' | 'CATEGORY' | 'PRODUCT_DETAIL' | 'IMAGE_ZOOM',
  scrollSection?: 'DETAIL_SECTION_1' | 'DETAIL_SECTION_2',
  topPanelIndex?: 1 | 2 | 3 | 4
}
```

- 遷移は `screen-flow.json` の `transitions` と整合させる。
- 4面同期レイヤ（イベント受信・ブロードキャスト）と UI レイヤ（各モニターの描画）を分離する。

### 推奨実装順序

1. `screenState` 遷移のみの骨格（モック UI）
2. `TOP` → `ANIMATION` → `PRODUCT_LIST` + 4面同期の配線
3. `PRODUCT_LIST` 探索操作（スワイプ・ピンチ・描画基盤）
4. `CATEGORY` / `PRODUCT_DETAIL` / `IMAGE_ZOOM`
5. 没入感演出・60fps / 低遅延の最適化

### 試作からの流用可否

| 試作要素 | 流用 | 備考 |
|----------|------|------|
| `#world` 仮想空間・カメラ移動 | 参考可 | 探索画面のパン/ズーム要件と親和 |
| バブル `clip-path` カラー露出 | 要要件確認 | xlsx はグレースケール配置が正。露出方式はデザイン合意要 |
| 画面状態管理 | 流用不可 | 新規に `screen-flow.json` ベースで実装 |

---

## 9. 非機能・運用要件（function.xlsx）

| 区分 | 要件 |
|------|------|
| システム | 画像・動画コンテンツ表示 |
| システム | 60fps の描画 |
| システム | 低遅延タッチレスポンス |
| 共通UI | TRUNKロゴタップで `TOP` へ |

過去 `setup/` にあったキオスク手順は Git 履歴 `f97e996` を参照。現リポジトリには同梱されていない。

---

## 10. 受入・検証

### チェックリスト（抜粋）

- [ ] 4台のいずれかでタップ → 4台とも `ANIMATION` へ同期遷移
- [ ] `ANIMATION` 終了 → 4台とも `PRODUCT_LIST`
- [ ] 探索画面で画像タップ → `IMAGE_ZOOM`、×で `PRODUCT_LIST`
- [ ] ハンバーガー → `CATEGORY` → カテゴリ選択 → `PRODUCT_DETAIL`
- [ ] `PRODUCT_DETAIL` で詳細-1/2 が別画面遷移になっていない（scroll のみ）
- [ ] ロゴタップで `TOP` 復帰
- [ ] 60fps・タッチ遅延が体感上問題ないこと（計測方法は別途定義）

---

## 11. リスク・注意事項

- **命名統一**: 実装・ドキュメント・テストで `screen-flow.json` の状態IDのみを使用する。
- **図の正**: `screen-flow.mmd` → `screen-flow.png`。旧 `screenflow.png` は廃止済み。
- **メディア未配置**: `assets/` 空のままでは E2E 検証不可。
- **作業ルール**: 最小差分・事前確認・Git 操作は指示があるまで実施しない（依頼主ルール）。

---

## 12. 付録

### A. 遷移マトリクス（簡易）

|  | TOP | ANIM | LIST | CAT | DETAIL | ZOOM |
|--|:---:|:---:|:---:|:---:|:---:|:---:|
| TOP | | ✓ | | | | |
| ANIM | | | ✓ | | | |
| LIST | ✓* | | | | ✓ | | ✓ |
| CAT | ✓* | | | ✓ | | ✓ | |
| DETAIL | ✓* | | | | ✓ | | |
| ZOOM | ✓* | | | ✓ | | | |

\* ロゴタップ。×やタップによる通常遷移は §6 参照。

### B. function.xlsx 要件一覧（全文連携）

画面別の全行は `function.xlsx` を参照。`screen-flow.md` に主要項目を転記済み。

### C. 関連 Git コミット

| コミット | 内容 |
|----------|------|
| `39229d9` | Initial |
| `1da7398` | 旧 screenflow 追加 |
| `f97e996` | setup / キオスク |
| `a242758` | 納品用整理（試作削除） |
| `6a97a62` | assets プレースホルダ |

---

## 変更履歴

| 版 | 日付 | 内容 |
|----|------|------|
| 1.0 | 2026-05-27 | 初版。function.xlsx 準拠で screen-flow 更新、状態ID統一 |
| 1.1 | 2026-05-27 | `FESTIVAL`（祝祭演出）廃止。function.xlsx 削除に合わせ screen-flow 更新 |
