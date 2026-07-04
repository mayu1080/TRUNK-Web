# DA：DOM + Motion UI確認

`PRODUCT_LIST` に重ねる DOM UI（`IMAGE_ZOOM` / `categoryDrawer`）の挙動を検証するデモです。

## 採用方式

**方式A：DA単体デモ**

- 背面 LIST は DOM の仮カード（Pixi は使わない）
- UI の出入り・重なり・背面操作ブロックだけを確認
- 方式B（DB Pixi の上に DOM UI を重ねる）は後続 DD 統合時に検討

## DB との違い（重要）

| | **DB** | **DA** |
|---|--------|--------|
| 役割 | Pixi 探索コア（パン・ピンチ・タップ・性能） | DOM + Motion UI（drawer・ZOOM・操作ブロック） |
| URL | `http://localhost:5173/` | **`http://localhost:5174/`** |
| 起動 | `npm run demo:db` | `npm run demo:da` |
| 画面上の目印 | 左上デバッグ「DB: Pixi探索コア」 | **青いバナー「DA \| DOM + Motion UI」** |

**`localhost:5173` を開いていると DB が表示されます。** DA を見るには **5174** を開いてください。

## 実行方法

### リポジトリ直下から（推奨）

```bash
cd LIST_demo
npm run demo:da
```

### デモフォルダから

```bash
cd LIST_demo/demos/DA-dom-motion-ui
npm install
npm run dev    # generate:index + Vite 起動（content 画像を読み込み）
```

ブラウザで **`http://localhost:5174/`** を開きます。

DB と同時に動かす場合:

```bash
# ターミナル1
cd LIST_demo && npm run demo:db   # → http://localhost:5173

# ターミナル2
cd LIST_demo && npm run demo:da   # → http://localhost:5174
```

ポートは `vite.config.ts` で固定（`strictPort: true`）。5174 が使用中ならエラーで止まり、別デモに取られません。

## 使用技術

- **Vite** + **React 18** + **TypeScript**
- **Framer Motion**（Motion アニメーション）

## 操作方法

| 操作 | 挙動 |
|------|------|
| 仮 LIST カードタップ | `IMAGE_ZOOM` overlay 表示 |
| Close × | overlay 閉じる |
| 右上ハンバーガー（☰） | `categoryDrawer` 開く |
| drawer Close × / scrim タップ | drawer 閉じる |
| カテゴリ行タップ | `selectedCategoryId` 更新 |
| 右下トグル | backdrop 閉じ / drawer scrim ON/OFF |

## 実装した UI

1. **仮 PRODUCT_LIST** — 黒背景 + **実画像**（`demo-asset-index.json` → `/content/...`）をグレースケール表示
2. **IMAGE_ZOOM** — 白カード + 選択画像、fade + scale + y 移動
3. **categoryDrawer** — 右スライド + opacity、カテゴリ（FOOD / GIFT / FLOWER / CM）
4. **デバッグパネル** — 状態・Motion 定数・`pointer blocked`
5. **デモバナー** — 画面上部に常時「DA」表示（DB との混同防止）

## レイヤー構造（z-index）

```text
z-index: 0    仮 LIST（mock cards）
z-index: 10   scrim（drawer 背面）
z-index: 20   IMAGE_ZOOM / categoryDrawer パネル
z-index: 30   バナー・ハンバーガー・デバッグ・トグル
```

## Motion 設定（`src/motionConfig.ts`）

### IMAGE_ZOOM

```text
duration: 220ms
easing: cubic-bezier(0.16, 1, 0.3, 1)
initial: opacity 0, scale 0.96, y 12
animate: opacity 1, scale 1, y 0
```

### categoryDrawer

```text
width: 360px
duration: 280ms
easing: cubic-bezier(0.32, 0.72, 0, 1)
closed: x 100%, opacity 0.8
open: x 0, opacity 1
```

### scrim

```text
duration: 200ms
easing: easeOut
opacity: 0 → 1
```

## 背面 LIST 操作ブロック

`pointerBlocked = isImageZoomOpen || isCategoryDrawerOpen`

- 仮 LIST 層に `pointer-events: none` + カード `disabled`
- overlay / drawer の scrim が背面タッチを受ける
- デバッグパネルに `pointer blocked: true / false` を表示

## タッチ UI

- ハンバーガー: **56×56px**
- Close ボタン: 最小 48px、推奨 56px
- drawer 行: 高さ 56px
- `:active` で press 反応（hover 非依存）

## 制限事項

- 背面 LIST は Pixi ではなく DOM 仮カード（方式A）
- 本番遷移（`screen-flow`）未接続
- `PRODUCT_DETAIL` 遷移なし
- 音なし / 本番デザイン未適用

## 本番コード

`app/` / content レイヤー / `screen-flow` には**触れていません**。
