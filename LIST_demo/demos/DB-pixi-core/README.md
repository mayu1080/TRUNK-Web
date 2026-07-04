# DB：Pixi探索コア

`PRODUCT_LIST` の探索コア（PixiJS）を社内検証するための簡易デモです。

## 目的

- `content/images/` 配下の実画像を再帰スキャンし、LIST 相当の探索画面にランダム表示する
- 40〜70枚の WebGL / texture 管理・パン・ピンチ・タップを検証する
- FPS・`selectedImageId`・簡易 `IMAGE_ZOOM` overlay の挙動を確認する

先方レビュー用の見た目（CULTISH 翻訳）は **DD** で実装します。

---

## 実行方法

```bash
cd LIST_demo/demos/DB-pixi-core
npm install
npm run generate:index   # demo-asset-index.json を生成
npm run dev              # 生成 + Vite 起動（内部で generate:index も実行）
```

または:

```bash
npm run demo:db
```

ブラウザで **`http://localhost:5173/`** を開きます。

> **DA（DOM + Motion UI）とは別ポートです。** DA は `http://localhost:5174/` — 5173 を開くと DB の Pixi デバッグ画面になります。

ランダム選定シードを変える場合: `http://localhost:5173/?seed=123`

---

## 実画像の置き場所

ローカルに以下へ配置してください（**Git 管理外**）。

```text
content/images/
  cm/
  flower/
  food/
  gift/
  list/
  （サブフォルダ配下も再帰的にスキャン）
```

例:

```text
content/images/flower/NATURE/NATURE①.png
content/images/food/若草/若草①.png
```

**客先画像は Git にコミットしないでください。** リポジトリには `sample_*.svg` のみ追跡対象として残しています。

---

## 採用方式

**方式A: Node スクリプトで `demo-asset-index.json` を生成**

```text
scripts/generate-demo-asset-index.mjs  →  public/demo-asset-index.json
```

Pixi デモ起動時に `public/demo-asset-index.json` を fetch し、画像 URL は `/content/images/...` 形式（Vite dev server の content ミドルウェア経由）で読み込みます。

### assetIndex 読み込み優先順位

| 優先 | 方式 |
|------|------|
| 1 | `window.trunkApi`（Electron preload 接続時） |
| 2 | `public/demo-asset-index.json`（**通常はこちら**） |
| 3 | mock fallback（実画像 0 枚時） |

---

## スキャン設定

`scripts/scan-config.mjs` で変更します。

```js
export const includeDirs = ['cm', 'flower', 'food', 'gift', 'list'];
export const excludeDirs = [];
```

### `cm` を除外する例

```js
export const excludeDirs = ['cm'];
```

### 対応拡張子

`.jpg` `.jpeg` `.png` `.webp` `.gif`

- `.gif` は Pixi で静止フレームとして読み込みます。問題があれば `scan-config.mjs` から外せます。
- `.svg` はスキャン対象外（リポジトリ同梱の `sample_*.svg` は mock fallback 用）

---

## 画像枚数ルール

| 実画像数 | 挙動 |
|----------|------|
| **0** | mock assetIndex にフォールバック + warning |
| **1〜39** | 複製して **40枚** 表示 + warning |
| **40〜69** | 全件表示（warning なし） |
| **70以上** | **ランダム70枚**（`?seed=` で再現可）+ warning |

---

## 操作方法

| 操作 | 挙動 |
|------|------|
| ドラッグ | パン + 慣性 |
| 2本指ピンチ | ズーム（ピンチ中心基準） |
| ホイール | ズーム（デスクトップ検証用） |
| タップ | 画像選択 → 簡易 IMAGE_ZOOM overlay |
| Close | 探索画面に戻る（overlay 中は LIST 操作 OFF） |

---

## デバッグ表示

左上パネル例:

```text
asset mode: real-content-recursive
source: content/images
folders: cm, flower, food, gift, list
real images: 52
displayed images: 52
duplicates: 0
textures: 48
warnings: 0
FPS: 60.0
...
```

---

## 表示サイズ正規化

元画像は変更せず、Pixi 上で **長辺ベースの均一 scale** を適用します。

```text
longSide = max(texture.width, texture.height)
scale = targetLongSide / longSide
sprite.scale.set(scale)  // 縦横同一 → 縦横比維持
```

### サイズ帯（`src/imageSizing.ts`）

| preset | 長辺目安 | 出現比率 |
|--------|----------|----------|
| small | 120〜180px | 45% |
| medium | 180〜280px | 40% |
| large | 280〜420px | 15% |

最大長辺上限: **420px**（`MAX_TARGET_LONG_SIDE`）

配置・ヒットテストは **表示後サイズ** + **zIndex 降順** + `world.toLocal`（renderer 座標）で判定します。

タップ座標は `devicePixelRatio` 補正済み renderer 座標に統一（`src/pointerCoords.ts`）。

デバッグパネルに min / max / avg 表示サイズ、preset 分布、タップ時の original / displayed / scale を表示します。

---

## 将来の画像最適化方針（本番想定）

本番では、元画像を直接変更せず、**LIST 用サムネイルを自動生成**する方針が望ましい。

- LIST では `content/thumbs/list/` の軽量画像を使用する
- `IMAGE_ZOOM` / `PRODUCT_DETAIL` では元画像または高解像度版を使用する

画像内に大きな余白（白背景など）が含まれる場合、縦横比維持の縮小だけでは余白は消えない。  
その場合は LIST 用サムネイルを別途作るか、アートディレクション側でトリミング可否を判断する。

**今回の DB デモでは行わないこと（後工程検討）:**

- 自動トリミング / 余白検出 / 中央切り抜き / 被写体検出 / 強制クロップ

---

## グレースケール

PixiJS `ColorMatrixFilter.greyscale()` を world コンテナに1つ適用。

---

## 制限事項

- 4面同時・30分常設テストは未実施
- 本番 `categoryDrawer` / 完成 UI なし
- 音なし
- `demo-asset-index.json` はローカル生成（`LIST_demo/` は Git 管理外）

---

## 関連

- 方針: `LIST_demo/reports/product-list-demo-strategy.md`
