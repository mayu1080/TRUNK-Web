# DF — Three.js Camera Depth

Three.js の `PerspectiveCamera` + Plane Mesh で、写真空間にカメラが入っていく体験を検証するデモ。

| | **DE** | **DF** |
|---|---|---|
| URL | http://localhost:5176 | **http://localhost:5177** |
| 描画 | PixiJS 疑似カメラ | **Three.js 本物の3D** |
| 画像 | Sprite | Plane Mesh + Texture |
| タップ | getBounds hit test | **Raycaster** |

## 起動

```bash
cd LIST_demo
npm run demo:df
```

または:

```bash
cd LIST_demo/demos/DF-three-camera-depth
npm install
npm run demo:df
```

ブラウザ: **http://localhost:5177/**

## 操作

| 操作 | 挙動 |
|------|------|
| ドラッグ | cameraX / cameraY |
| ホイール | cameraZ スクラブ（無限 wrap） |
| **Shift + ホイール上** | ドリークルーズで潜る（慣性・無限循環） |
| **Shift + ホイール下** | ドリークルーズで引く（巻戻し・無限循環） |
| Shift 離す | 急停止せずブレーキでぬるく減速 |
| タップ | Raycaster で画像選択 → IMAGE_ZOOM |
| ハンバーガー | categoryDrawer |
| **G / D** | review ↔ debug |
| **R** | review |
| visual preset | clean / cultish-soft / cultish-heavy / soft-tint |
| Hit test debug | Raycaster 候補枠をオーバーレイ表示 |

## visual preset

右下セレクトで切替（ノイズ・fog・ティント）:

- **soft-tint** — デフォルト。暖色ティント
- **cultish-soft / heavy** — ノイズ強弱
- **clean** — ノイズ OFF・ニュートラル

DE の Shift は「時間倍率の一時ブースト」。DF は **カメラ速度＋惰性＋ソフト境界＋軽い FOV breathe** の映画風ドリー。

## 技術

- Three.js: Scene / PerspectiveCamera / WebGLRenderer / PlaneGeometry / Texture / Raycaster
- 画像向き: **方式A（正面向き固定）**
- DOM UI: IMAGE_ZOOM / categoryDrawer（DD 流用）
- canvas: 1枚
- 画像: `content/images` via `demo-asset-index.json`（最大70枚）
