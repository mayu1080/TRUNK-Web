# DI — Three Bubble Reveal

DF（Three.js Camera Depth）をベースに、**Bubble Color Reveal** を統合したデモ。

白黒化された写真空間の中で、カーソル / 指の周囲にシャボン玉 UI を表示し、その範囲だけ画像の色が戻る体験を検証する。

| | **DF** | **DI** |
|---|---|---|
| URL | http://localhost:5177 | **http://localhost:5178** |
| 描画 | Three.js PerspectiveCamera | 同左 + **screen-space shader reveal** |
| Bubble | なし | **DOM UI + カラー復帰** |

## 起動

```bash
cd LIST_demo
npm run demo:di
```

または:

```bash
cd LIST_demo/demos/DI-three-bubble-reveal
npm install
npm run demo:di
```

ブラウザ: **http://localhost:5178/**

## 操作

| 操作 | 挙動 |
|------|------|
| ポインタ移動 | Bubble UI 追従 + 周囲だけカラー復帰 |
| ドラッグ | cameraX / cameraY（DF と同） |
| ホイール | cameraZ スクラブ（無限 wrap） |
| **Shift + ホイール** | ドリークルーズ |
| タップ | Raycaster → IMAGE_ZOOM |
| ハンバーガー | categoryDrawer |
| **G / D** | review ↔ debug |
| **R** | review |

IMAGE_ZOOM / drawer 開中は Bubble を停止・非表示。

## Bubble 実装

- **方式**: Three `MeshBasicMaterial` + `onBeforeCompile` **screen-space shader**
- **UI**: DOM overlay（`pointer-events: none`）、screen px 固定サイズ
- **reveal**: NDC 中心 + screen px 半径（見た目一定）
- DOM / clip-path（Test_TRUNK）は移植していない

## 技術

- ベース: `DF-three-camera-depth`（本体は変更なし）
- canvas: 1枚
- 画像: 約70枚 Plane Mesh
- Review Mode でも Bubble UI + カラー復帰は表示（Debug 数値のみ隠す）
