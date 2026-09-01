# DD：Pixi + Three風 + DOM + Motion

先方レビュー候補の方向性確認デモ。**PixiJS 1 canvas** + **DOM UI** + **CULTISH 5 風 2.5D 表現**（Three.js は使わない）。

## 目的

- DB の Pixi 探索コア（パン・ピンチ・タップ・実画像）を維持したまま
- DA の DOM UI（`IMAGE_ZOOM` / `categoryDrawer`）を重ねる
- 暗背景・粒状ノイズ・深度・パララックス・浮遊・タッチ微反応で「Three.js 風」奥行きを Pixi 上で再現
- 本番候補 D案として成立しそうか判断する

**本番実装・最終デザインではありません。**

## 実行方法

```bash
cd LIST_demo
npm run demo:dd
```

または:

```bash
cd LIST_demo/demos/DD-pixi-three-style
npm install
npm run dev
```

ブラウザ: **`http://localhost:5175/`**（E — object-flow）

| デモ | ポート | 内容 |
|------|--------|------|
| DB Pixi | 5173 | 探索コア |
| DA DOM UI | 5174 | Motion UI |
| **DD** | **5175** | E object-flow |
| **DE** | **5176** | E-2 camera-navigation（`npm run demo:de`） |

DD と DE は同時起動して比較できます。

## キーボード（デモ共通仕様 — 削除しない）

| キー | 動作 |
|------|------|
| **G** または **D** | review ↔ debug トグル |
| **R** | review モード（デバッグ UI 非表示） |

debug モードで tone preset・visual preset・FPS・ヒットテスト等を切り替え可能。

## DB から流用

- PixiJS 描画・パン・ピンチ・慣性・ホイールズーム
- `content/images/` 再帰スキャン → `demo-asset-index.json`
- 画像サイズ正規化・グレースケール・ランダム配置
- タップヒットテスト（renderer 座標 + DPR）
- FPS / texture memory / canvas 数デバッグ

## DA から流用

- ハンバーガー → `categoryDrawer`（FOOD / GIFT / FLOWER / CM）
- `IMAGE_ZOOM` 白カード + Framer Motion
- scrim / `pointer-events` / z-index 整理
- overlay・drawer 中の背面 LIST 操作ブロック

## 追加した CULTISH 翻訳表現

| 表現 | 実装 |
|------|------|
| 暗背景の質感 | DOM グラデーション + Pixi 透明背景 |
| 粒状ノイズ | DOM `feTurbulence` SVG タイル overlay（`mix-blend-mode: overlay`） |
| 深度レイヤー | depth flow（E）: 連続 flowDepth + ループ respawn、単一 imageContainer |
| パララックス | depth flow 有効時は OFF（legacy プリセットのみレイヤー別） |
| 浮遊感 | sin による y / rotation 微揺れ |
| タッチ微反応 | ポインタ近傍の scale / 遅延オフセット |
| タップ手前遷移 | タップ後 scale + 明るさバンプ → `IMAGE_ZOOM` |

## visualConfig / プリセット

`src/visualConfig.ts` で調整。右下セレクトで切替:

- **clean** — 表現ほぼ OFF（DB 寄り）
- **cultish-soft** — デフォルト。控えめなノイズ・深度・浮遊（ぱきっとした soft-mono）
- **cultish-heavy** — ノイズ・パララックス・浮遊を強め
- **soft-tint** — DF 寄り。輝度グレースケール + 暖色ティント（tone preset 非適用）

## 操作方法

| 操作 | 挙動 |
|------|------|
| ドラッグ | パン |
| ピンチ / ホイール | ズーム |
| **Shift + ホイール上** | 一時的に奥→手前を ×2.75（Shift 離すと初期速度へ） |
| **Shift + ホイール下** | 一時的に手前→奥（逆再生）を ×2.75（Shift 離すと初期速度へ） |
| 画像タップ | 手前バンプ → `IMAGE_ZOOM` |
| 右上ハンバーガー | `categoryDrawer` |
| 右下 preset | visual プリセット切替 |

## デバッグ表示

左上パネル: demo id、noise / depth / float / touch reaction、overlay 状態、`pointer blocked`、FPS、texture memory、canvas 数、`selectedImageId` など。

## ON/OFF できる表現

プリセット **clean** でほぼ全 OFF。**cultish-soft / heavy** で noise・depth・parallax・float・touch reaction を有効化。

## 技術制約

- **WebGL canvas: 1 枚**（Pixi のみ）
- **Three.js 不使用**
- 本番 `app/` / `screen-flow` / content レイヤー未変更

## 既知の制限

- ノイズは DOM overlay（WebGL フィルタではない）
- 深度 blur は depth flow（E）で per-sprite `BlurFilter` を使用
- `categoryDrawer` はデモ用カテゴリのみ（本番遷移なし）
- 音なし
- 4 面 30 分ストレステストは未実施

## パフォーマンス上の懸念

- 画像枚数 × per-sprite `ColorMatrixFilter` が GPU 負荷要因
- `cultish-heavy` + 70 枚で FPS 低下の可能性 → デバッグ FPS で確認
- ノイズ DOM は軽量だが `mix-blend-mode` は端末依存

## 次に検討すべきこと

- 方式 B 統合の本番 API 接続（`trunkApi`）
- フィルタバッチ化 / シェーダー統合で draw call 削減
- DD 上での 4 面・長時間安定性テスト
- DC（Three.js 上限スパイク）との見た目比較
