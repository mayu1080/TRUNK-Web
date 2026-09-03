# open-questions（未決事項）— テンプレート

> **使い方**: 本ファイルは Git 管理のテンプレートです。
> ローカル作業用に `docs/open-questions.md` へコピーし、そちらで更新してください。
> `open-questions.md` は `.gitignore` により GitHub へアップロードされません。

```powershell
Copy-Item docs\open-questions.example.md docs\open-questions.md
```

---

## 確定事項（参照用）

### 機能挙動

| 項目 | 内容 |
|------|------|
| 機能挙動の正 | `docs/Design_Check0622.mp4` |
| screenState | TOP / ANIMATION / PRODUCT_LIST / IMAGE_ZOOM / PRODUCT_DETAIL |
| CATEGORY | categoryDrawer（PRODUCT_LIST 上） |
| 4面同期範囲 | TOP → ANIMATION → PRODUCT_LIST |
| 全台 TOP 時のみ | TOP → ANIMATION の4面同期開始 |
| LIST 以降 | 各モニター独立 |
| TRUNK ロゴ | 装飾のみ |
| 無操作 | 10分・当該モニターのみ TOP。スワイプ/ピンチ/スクロールでリセット |

### ランタイム・運用（確定）

| 項目 | 内容 |
|------|------|
| 本体 | Electron + Web |
| 運用 | Windows `.exe` |
| 素材 | 実行ファイル横 `content/`（ビルド非同梱） |
| MVP | サーバー/DB 不使用 |
| Unity（アプリ本体） | 現時点では採用しない |
| content 読込 | Main 起動時に assetIndex 生成（Phase 2 実装済） |

### 4面同期 IPC（MVP・確定）

| 項目 | 内容 |
|------|------|
| 構成 | 1 PC / Electron / 4 BrowserWindow / 4 タッチモニター |
| 方式 | **Electron Main 中央管理 + IPC** |
| 流れ | Renderer → preload → Main → 必要 window へ IPC 配信 |
| WebSocket / UDP | MVP では**不使用**（複数 PC 構成時の拡張候補） |

---

## 未決事項

### Q1. ハードウェア

| # | 項目 |
|---|------|
| 1 | 各モニター解像度・向き・DPI |
| 2 | GPU 要件（60fps） |

### Q2. UI / 体験

| # | 項目 |
|---|------|
| 1 | TOP の「指定箇所タップ」ヒット領域 |
| 2 | 詳細画面「4セクション」と DETAIL_SECTION_1/2 の対応 |
| 3 | CM 動画の再生タイミング |

### Q3. PRODUCT_LIST（未決・後ほど重点検討）

**Phase 2 では描画方式・デザイン・操作感には手を付けない。**
全ワークフロー約 70% を LIST 検討に割く前提。

| # | 項目 |
|---|------|
| 1 | **描画方式**（DOM / Canvas / PixiJS / Three.js / Unity 本体 / Unity 素材 / TD 連携 等） |
| 2 | デザイン・演出・操作感 |
| 3 | Web のみか Unity 等併用か |

比較観点: デザイン表現力、40〜70枚性能、タッチ、パン/ピンチ、ランダム配置、奥行き、グレースケール、content 連携、4面表示、保守性、現場安定性 等（`architecture.md` 参照）。

### Q4. 運用・将来

| # | 項目 |
|---|------|
| 1 | Electron パッケージングツール（electron-builder 等） |
| 2 | 複数 PC 構成にする場合の同期方式（WebSocket/UDP 等） |
| 3 | 遠隔 content 同期（MVP 外） |
