# Bubble Color Reveal System

## 概要

白黒化された画像空間の中で、タッチ操作によって「色が戻る」領域を作りながら探索する、インタラクティブ演出プロトタイプです。

本リポジトリは **L1（体験成立）** の実装を目標とし、画面遷移や要件定義は `docs/` を正とします。

- **画面遷移（正）**: `docs/screenflow.png` / `docs/screenflow.md` / `docs/screenflow.json` / `docs/screen-flow.mmd`
- **見積・スケジュール用要件（MUST）**: `docs/function.xlsx`

---

## 現在の主な仕様

- 実機の画面サイズを自動取得
- 画面サイズ固定ではなく `100vw / 100dvh` で表示
- 仮想空間 `#world` を持つ
- 白黒画像レイヤーとフルカラー画像レイヤーを重ねる
- `clip-path` によりシャボン玉部分だけカラー表示
- 2本指タッチでシャボン玉表示
- 1本指でシャボン玉移動
- 2本指ピンチで空間全体をズーム
- シャボン玉が画面端に近づくと仮想空間が自動スライド
- 3本指タッチでシャボン玉非表示

---

## 画面構造

```html
#viewport
  ├ #world
  │   ├ #bg-gray
  │   └ #color-layer
  └ #bubble
```

### 各要素の役割

#### `#viewport`

実際に見えている画面領域です。

```css
width: 100vw;
height: 100dvh;
overflow: hidden;
```

端末が iPhone / iPad / Android などで変わっても、実機の表示サイズに追従します。

#### `#world`

画像が配置される仮想空間です。

現在の設定：

- width: `3000px`
- height: `1800px`

この空間を `cameraX / cameraY / worldScale` によって移動・拡大縮小します。

#### `#bg-gray`

白黒画像レイヤーです。

```css
filter: grayscale(100%);
```

#### `#color-layer`

フルカラー画像レイヤーです。

通常は非表示で、シャボン玉の円形範囲だけ表示されます。

```css
clip-path: circle(...);
```

#### `#bubble`

画面上に表示されるシャボン玉UIです。

仮想空間とは別に、画面上のUIとして固定表示されます。

---

## 操作方法

### シャボン玉を表示

2本指でタッチ。

### シャボン玉を移動

1本指でドラッグ。

### 空間をズーム

2本指でピンチイン / ピンチアウト。

ピンチアウトで拡大、ピンチインで縮小します。

### 空間をスライド

シャボン玉を画面端に近づけると、仮想空間が上下左右に自動でスライドします。

端末サイズは自動取得されるため、実機が未定でも動作します。

### シャボン玉を非表示

3本指でタッチ。

2本指はズーム操作に使用するため、非表示操作は3本指に分けています。

---

## 主要パラメータ

### 仮想空間サイズ

```js
const worldWidth = 3000;
const worldHeight = 1800;
```

### ズーム範囲

```js
const minScale = 0.7;
const maxScale = 2.4;
```

### シャボン玉サイズ

```js
const bubbleSize = 250;
```

### 画面端判定

```js
const edgeThreshold = Math.min(viewportWidth, viewportHeight) * 0.12;
```

画面サイズの12%以内にシャボン玉が入ると、自動スライドします。

### スライド速度

```js
const panSpeed = 10 / worldScale;
```

ズーム倍率に応じて移動速度を補正しています。

---

## 座標変換の考え方

画面上の指の位置を、仮想空間上の座標に変換します。

```js
worldX = cameraX + screenX / worldScale;
worldY = cameraY + screenY / worldScale;
```

これにより、ズーム中でもシャボン玉の下にある画像位置を正しくカラー表示できます。

---

## ズーム処理の考え方

ピンチ中心の座標を基準にズームします。

これにより、ピンチ操作中に画像が急に飛ぶような挙動を防ぎます。

---

## 画像の変更方法

画像は白黒レイヤーとカラーレイヤーの両方に同じものを配置します。

```html
<img class="photo photo-1" src="画像URL">
```

同じ `photo-1` を両方のレイヤーに入れる必要があります。

---

## 画像サイズの変更

CSS の `.photo` を変更します。

```css
.photo {
  width: 520px;
  height: 360px;
}
```

---

## 画像位置の変更

CSS の `.photo-1` などを変更します。

```css
.photo-1 {
  left: 80px;
  top: 80px;
}
```

---

## 注意点

- 外部画像を使っているため、インターネット接続が必要
- iOS Safari対策として `passive: false` を使用
- ピンチ操作はブラウザ標準ズームではなく、独自ズームとして処理
- `clip-path` は古いAndroidブラウザでは挙動差が出る可能性あり

---

## 今後の拡張案

- シャボン玉の複数表示
- シャボン玉内の歪み表現
- 慣性スクロール
- 画像タップによる全画面展開
- Canvas / WebGL化
- ローカル画像読み込み対応

---

## 補足

この版では、端末解像度を固定せずに `window.innerWidth / innerHeight` を使っているので、iPhoneでもiPadでも画面端判定が動く構造になっています。