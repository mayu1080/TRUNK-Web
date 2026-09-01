# DF Three.js Camera Depth — 実装レポート

| 項目 | 内容 |
|------|------|
| 版 | 1.0 |
| 作成日 | 2026-07-11 |
| 対象 | `LIST_demo/demos/DF-three-camera-depth` |
| 目的 | 新 Agent が `DI-three-bubble-reveal` を作る前に、DF の構造・定数・拡張点を引き継ぐ |
| 本ドキュメントの範囲 | **ドキュメントのみ**。DF 追加実装・DE 修正・Bubble 実装・DI 作成・本番 `app` 反映は対象外 |

機械可読版: [`DF-three-camera-depth-implementation-report.json`](./DF-three-camera-depth-implementation-report.json)

関連:

- Bubble 仕様: [`bubble-color-reveal-spec.md`](./bubble-color-reveal-spec.md)
- DE / DF 比較: [`DE-vs-DF-comparison-report.md`](./DE-vs-DF-comparison-report.md)

---

## 1. デモ概要

| 項目 | 内容 |
|------|------|
| デモ名 | **DF-three-camera-depth**（`DEMO_ID = 'DF'`） |
| URL | http://localhost:5177/ |
| ポート | **5177**（`strictPort: true`） |
| 起動 | `cd LIST_demo && npm run demo:df` |
| 代替起動 | `cd LIST_demo/demos/DF-three-camera-depth && npm install && npm run demo:df` |
| 実装目的 | Three.js の本物の `PerspectiveCamera` で写真空間に入り込む体験を検証する。DE（Pixi 疑似カメラ）との比較用 |
| canvas | **1枚**（`WebGLRenderer.domElement`） |

### DE / DD との違い

| | DD | DE | **DF** |
|---|---|---|---|
| 描画 | PixiJS | PixiJS（DD 共有 + `VITE_DEMO_ID=DE`） | **Three.js** |
| カメラ感 | depthFlow / 疑似奥行き | cameraDepth + timeScale | **本物の PerspectiveCamera** |
| 画像 | Sprite | Sprite | **Plane Mesh + Texture** |
| 枚数目安 | — | 約 60 | **約 70** |
| Hit | pointerup 手動 bounds | 同左（修正済み） | **Raycaster** |
| Shift+wheel | depthFlow 速度 | scene timeScale ブースト | **dolly cruise（カメラ速度＋慣性）** |
| DOM UI | IMAGE_ZOOM / drawer | 同左 | **DD 系を流用** |

### 現在の完成度

- カメラ操作（drag / wheel / Shift+dolly cruise / 無限 Z wrap）: **実装済み・体感良好**
- 画像 Plane・配置・ドリフト・グレースケール＋ティント: **実装済み**
- Raycaster → IMAGE_ZOOM / categoryDrawer / review・debug: **実装済み**
- visual preset（soft-tint 等）: **実装済み**
- Hit debug overlay: **実装済み**
- Bubble / DI: **未着手**（本レポートの後続）

### 現在の体感（主観込み）

- wheel 時のカメラ移動は**ぬるぬる動く**（smoothing + cruise 慣性）
- DE より**空間に入っていく感覚が強い**（本物の遠近・fog）
- Raycaster の hit は**比較的快適**（DE の bounds hit より迷いが少ない印象）
- Shift+wheel のドリーは映画的で、クライアント見せの満足度が高い
- まだ調整不足の箇所: tap 閾値（12px / 500ms）は DE より厳しめ、`HIT_TEST_MIN_ALPHA=0.18`、奥画像の見え方・トーン、`softBoundMargin` 未使用、テクスチャ逐次ロードの待ち

---

## 2. 変更・追加したファイル一覧

DF 実装で追加されたデモ本体と、LIST_demo 側の配線。

### 2.1 デモ本体 `LIST_demo/demos/DF-three-camera-depth/`

| ファイル | 役割 | 主な処理 |
|----------|------|----------|
| `package.json` | デモ npm 定義 | three / react / framer-motion、scripts、依存 |
| `vite.config.ts` | Vite | port 5177、`/content` middleware、`fs.allow` |
| `index.html` | HTML 入口 | React root |
| `tsconfig.json` | TS 設定 | — |
| `scripts/copy-demo-index.mjs` | アセット索引コピー | DB の `demo-asset-index.json` → `public/` |
| `public/demo-asset-index.json` | 生成物 | 画像一覧インデックス |
| `README.md` | デモ説明 | 起動・操作・DE 比較 |
| `src/main.tsx` | エントリ | React mount + CSS |
| `src/App.tsx` | アプリ骨格 | ExploreController、overlay、drawer、mode、preset、pointerBlocked |
| `src/styles.css` | スタイル | z-index、chrome、zoom/drawer、noise、hit-debug |
| `src/demoIdentity.ts` | 識別子 | `DEMO_ID/URL/NAME` |
| `src/uiMode.ts` | UI モード | review / debug |
| `src/types.ts` | 型 | Asset / DebugStats |
| `src/motionConfig.ts` | DOM モーション | IMAGE_ZOOM / drawer 定数のみ（カメラなし） |
| `src/visualConfig.ts` | 見た目プリセット | fog / tint / noise / listAlpha |
| `src/assetLoader.ts` | アセット読込 | index fetch → `/content` URL、mock フォールバック |
| `src/imageSelection.ts` | 枚数制御 | seed 選択、70 枚 cap / 不足時 duplicate |
| `src/three/exploreController.ts` | **中核** | Scene / Camera / Renderer / cards / input / raycast / RAF |
| `src/three/sceneLayout.ts` | 空間定数 + 配置 | CAMERA / DOLLY / TAP / HIT / CARD_MOTION / placements |
| `src/three/hitTestDiagnostics.ts` | Hit 診断 | Raycast probe、mesh AABB 投影 |
| `src/three/fpsCounter.ts` | FPS | 500ms 窓の平均 |
| `src/ui/DebugPanel.tsx` | Debug HUD | Stats 表示 |
| `src/ui/DemoBanner.tsx` | バナー | DF 識別 |
| `src/ui/DemoToggles.tsx` | トグル | preset / mode / hit-debug / zoom・drawer 試験 |
| `src/ui/HitTestDebugOverlay.tsx` | Hit 可視化 | 十字・候補 bounds |
| `src/ui/ImageZoomOverlay.tsx` | IMAGE_ZOOM | Framer Motion カード + scrim |
| `src/ui/CategoryDrawer.tsx` | カテゴリ | 右ドロワー + scrim |
| `src/ui/NoiseOverlay.tsx` | ノイズ DOM | タイルノイズ |
| `src/ui/noiseTexture.ts` | ノイズ生成 | PNG or procedural |
| `src/ui/zoomContent.ts` | ZOOM コピー | brand / title / body mock |

### 2.2 LIST_demo 配線

| ファイル | 役割 | 主な処理 |
|----------|------|----------|
| `LIST_demo/package.json` | ルート scripts | `"demo:df": "... --prefix demos/DF-three-camera-depth"` |
| `LIST_demo/README.md` | デモ表 | DF 行（5177） |

### 2.3 触っていないもの（明示）

- `app/`（本番）
- `DB` / `DA` / `DD` / `DE` のソース本体（DF は独立デモ。索引生成で DB の `generate:index` を呼ぶのみ）

---

## 3. 使用技術

| 技術 | 用途 |
|------|------|
| **Three.js ^0.172** | 3D シーン全体 |
| **PerspectiveCamera** | 空間カメラ（fov 52） |
| **Scene** | FogExp2 付きルート |
| **WebGLRenderer** | canvas 1 枚、antialias、alpha:false |
| **PlaneGeometry** | 画像カード |
| **MeshBasicMaterial** | map + tint + transparent、fog 有効、`onBeforeCompile` でグレースケール |
| **TextureLoader** | `loadAsync` で逐次ロード |
| **Raycaster** | tap 時の画像選択 |
| **React 18** | App / UI |
| **framer-motion** | IMAGE_ZOOM / drawer |
| **DOM / Motion UI** | DD 系を移植（zoom / drawer / hamburger / noise） |
| **Debug panel** | monospace HUD |
| **Review mode** | デフォルト。G/D で debug、R で review |

---

## 4. Three.js 構成

### renderer / canvas / scene / camera

すべて `ExploreController.init(host)`（`src/three/exploreController.ts`）:

1. `new THREE.WebGLRenderer({ antialias: true, alpha: false })`
2. `setPixelRatio(min(devicePixelRatio, 2))`、`setClearColor(0x0a0a0a)`
3. `renderer.domElement.classList.add('three-canvas')`、`touchAction = 'none'`
4. `host.appendChild(renderer.domElement)` ← **canvas 生成・配置場所**
5. `new THREE.Scene()` + `FogExp2(0x0a0a0a, visualConfig.fogDensity)`
6. `new THREE.PerspectiveCamera(fov, aspect, near, far)`

### camera 初期値（`CAMERA_CONFIG` in `sceneLayout.ts`）

| パラメータ | 値 |
|------------|-----|
| fov | **52** |
| near | **10** |
| far | **10000** |
| initialX / Y / Z | **0 / 0 / 1800** |
| minZ / maxZ | **200 / 4200** |
| minX / maxX | **-2200 / 2200** |
| minY / maxY | **-1400 / 1400** |
| lookAt | `(cameraX, cameraY, cameraZ - 1000)` |

### render loop

`requestAnimationFrame` → `deltaTime` clamp ≤ 0.05s → `updateCameraSmoothing` → `updateCardMotion` → `renderer.render(scene, camera)` → `emitStats`（200ms throttle）

### resize

`ResizeObserver` on host → `camera.aspect` / `updateProjectionMatrix` / `renderer.setSize`

### texture / Plane Mesh

- `TextureLoader.loadAsync(url)`（失敗時 warning して skip）
- `SRGBColorSpace`、LinearFilter
- 長辺 `280 * scaleMul` でアスペクト維持
- `PlaneGeometry(width, height)` + `MeshBasicMaterial`
- `faceCameraForward`: `rotation.set(0, 0, rotZ)` — **方式 A（正面向き固定、真の billboard ではない）**
- `scene.add(mesh)` + `imageMeshes[]` / `cards[]`

### mesh.userData

```ts
{
  imageId: string;       // meta.id
  imageUrl: string;      // meta.url
  currentAlpha: number;  // 毎フレーム更新（depth fade）
  isImageCard: true;
}
```

カード内部状態は `cards: ThreeImageCard[]`（sceneX/Y/Z、mesh、texture、idle 位相など）。userData より厚い。

---

## 5. 画像処理

| 項目 | 内容 |
|------|------|
| 読み込み元 | `public/demo-asset-index.json` → URL `/content/<relativePath>`（Vite middleware が repo `content/` を配信） |
| 索引生成 | DB `generate:index` → `copy-demo-index.mjs` |
| 表示枚数 | **70**（`TARGET_IMAGE_COUNT` / `SCENE_LAYOUT.imageCount`） |
| 不足時 | seeded duplicate（id に `__dup001` 等）、警告 |
| 過多時 | seeded shuffle して 70 枚 |
| 貼り方 | `MeshBasicMaterial.map = texture` |
| 縦横比 | テクスチャ width/height から width/height 算出（fallback 512） |
| サイズ正規化 | 長辺 = `280 * scaleMul`（scaleMul 0.72–1.28） |
| 配置 | セル分割 + jitter（`fieldJitter: 0.82`）、min XY dist 140 |
| Z 分布 | far/mid/near 3 帯に層化（`zRange: [-3000, 1200]`） |
| 向き | 正面向き固定（方式 A） |
| billboard | **なし**（毎フレーム lookAt しない） |
| グレー / トーン | shader `onBeforeCompile` で luma グレー化 → material `color` で暖色 tint 乗算。preset で tint/fog/noise 切替 |

ランタイム:

- 奥→手前ドリフト（`sceneDriftSpeed: 72`）
- near/far で alpha・scale・tint、手前抜け / 奥飛びで respawn
- idle 微揺（X/Y/rot）

---

## 6. カメラ操作

| 操作 | 挙動 |
|------|------|
| drag（1 本指） | `targetCameraX/Y` を更新（sensitivity **1.35**）、clamp |
| wheel（通常） | cruise を急ブレーキ → `targetCameraZ` スクラブ → **無限 wrap** |
| Shift+wheel | `cruiseVelocityZ` にインパルス（潜る / 引く） |
| Shift 離す | `releaseBrake` でぬるく減速 |
| timelinePosition | `(maxZ - cameraZ) / (maxZ - minZ)`（0–1） |

状態変数:

- 現在: `cameraX/Y/Z`（smoothing 後）
- 目標: `targetCameraX/Y/Z`
- smoothing: **0.12**（クルーズ中は `poseSmoothingCruise: 0.2`）
- FOV breathe: base 52 + 最大 **+3.2°**（クルーズ速度連動）

dolly / cruise:

- `impulsePer100px: 520`、`maxSpeed: 1600`
- `coastFriction: 1.15` / `releaseBrake: 3.8` / `scrubCancelBrake: 8`
- `infiniteLoop: true` — Z が範囲外ならカメラと全 card の `sceneZ` を span 分シフト
- `softBoundMargin: 420` は定義のみ（**未使用**）

操作の衝突回避:

- overlay / drawer 中は `interactionEnabled = false`（pointer ハンドラ early return）
- 通常 wheel は cruise を殺してからスクラブ
- tap は drag 開始後は発火しない

---

## 7. Tap / Hit 判定

流れ（`exploreController`）:

1. **pointerdown**: `startX/Y`、`startTime`、`dragging=false` を記録、pointer capture
2. **pointermove**: 移動 ≥ **12px** で `dragging=true` → X/Y pan
3. **pointerup**: move ≤ 12px かつ duration ≤ **500ms** かつ !dragging → tap
4. tap 時 `handleTap` → NDC 変換 → Raycaster

NDC:

```text
ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1
ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1
```

Raycaster:

- `raycaster.setFromCamera(ndc, camera)`
- `intersectObjects(imageMeshes, false)`
- 除外: `!userData.isImageCard` / `currentAlpha < 0.18` / `!visible`
- **採用: 配列先頭 = Raycaster の distance 最小**（Three.js 既定の距離順）
- `selectedImageId = userData.imageId`
- `callbacks.onImageTap({ id, url })` → App が `setIsImageZoomOpen(true)`

診断: `hitTestDiagnostics.runRaycastHitTest`（debug overlay 用 bounds 付き）

---

## 8. DOM UI 流用

DD / DE 系と同じ構成を DF 内にコピー:

| UI | 実装 | 備考 |
|----|------|------|
| IMAGE_ZOOM | `ImageZoomOverlay.tsx` + `motionConfig.imageZoomOpen` | AnimatePresence。閉時 unmount |
| categoryDrawer | `CategoryDrawer.tsx` | 右スライド + scrim |
| hamburger | App 内ボタン | drawer toggle / close |
| scrim | zoom-backdrop / drawer-scrim | `pointer-events: auto`（表示中のみ） |
| canvas ブロック | `pointerBlocked = zoom \|\| drawer` → `setInteractionEnabled(false)` | |
| chrome | `.ui-chrome-layer { pointer-events: none }` + 子だけ `auto` | canvas を奪わない |
| noise / vignette / gradient | DOM、`pointer-events: none` | |
| Review | デフォルト。バナー・debug・toggles 非表示 | |
| Debug | G/D。DebugPanel + DemoToggles + Hit overlay 可 | |

IMAGE_ZOOM 開閉タイムライン（目安）: scrim 180ms、card delay ~33ms、card fade 210ms。

---

## 9. Debug panel 項目

`DebugPanel` / `DebugStats` に出る主な項目:

- FPS
- canvas count
- image mesh count / texture count
- camera position（X,Y,Z）
- target camera position
- timelinePosition / target
- dolly cruise（vZ / active / Shift）
- fov
- visual preset / hit debug ON・OFF
- wheel / drag / tap 説明文字列
- **raycast candidates**
- **chosen imageId / chosen distance**
- **selectedImageId**
- **overlay open / drawer open**
- interaction / overlayState
- images（displayed / real）/ asset mode
- last action / warnings（最大 4）

---

## 10. パフォーマンス・体感

| 項目 | 現状メモ |
|------|----------|
| FPS | 通常 60 前後を狙える想定（stats 表示）。枚数・GPU 依存 |
| 画像枚数 | **70** |
| 70 枚前後の操作感 | ぬるぬる。空間感は DE より強い |
| wheel 滑らかさ | **良い**（smoothing + wrap） |
| drag 滑らかさ | **良い** |
| tap / Raycaster | **快適寄り**（DE より渋さが少ない） |
| Console エラー | テクスチャ失敗時は warning 積み上げ。致命的エラーは基本なし想定 |
| Context Lost | 明示ハンドラは DE/DD ほど厚くない（要監視） |
| 重い処理 | 起動時 `loadAsync` 逐次、毎フレーム全 card の motion / alpha、fog |
| DE より良い点 | 遠近・dolly・Hit の素直さ・クライアント満足度 |
| DE より悪い点 | Three 依存・実装量が独立、tap 閾値がやや厳しめ、逐次テクスチャ待ち |

---

## 11. 既知の問題

1. **texture 読み込み待ち** — 逐次 `loadAsync`。失敗カードは skip + warning
2. **黒画面リスク** — clear / fog / body が `#0a0a0a`。テクスチャ未着だと真っ暗に見える。過去に DOM gradient の opaque が canvas を覆う事故あり → gradient は半透明 + `pointer-events: none` 必須
3. **resize** — ResizeObserver あり。ホスト CSS 崩れ時は aspect ズレに注意
4. **overlay pointer-events** — 閉時 unmount 前提。chrome の full-bleed `auto` は禁止
5. **camera clamp / wrap** — XY は clamp、Z は infinite wrap。`softBoundMargin` 未使用
6. **Z 分布 / トーン** — farAlphaFloor 0.55 等は調整余地。Hit 除外 alpha **0.18** は DE（0.08）より厳しめ
7. **tap 閾値** — 12px / 500ms。idle 微動があるため、必要なら DE 寄りに緩和可
8. **Vite / index** — DB index 欠落時 copy は warn で続行 → mock に落ちる可能性。`cache: 'no-store'`。他デモ同様 `.vite` キャッシュ汚れに注意
9. **port 5177 occupied** — `strictPort` で起動失敗
10. **billboard なし** — 横に大きくパンすると平面の側面が見える（仕様）

---

## 12. DI-three-bubble-reveal に渡すべき情報

### 必須方針

1. **DF を直接変更しない** — `DF-three-camera-depth` を **コピー**して `DI-three-bubble-reveal` を作る
2. ポートは DF(5177) と衝突しない新規ポートを割り当て（例: 5178。LIST_demo の慣習に合わせる）
3. Bubble 仕様は [`bubble-color-reveal-spec.md`](./bubble-color-reveal-spec.md) を正とする（描画方式は Three 前提で再設計）

### コピー対象（推奨）

```text
LIST_demo/demos/DF-three-camera-depth/  →  LIST_demo/demos/DI-three-bubble-reveal/
```

その後:

- `demoIdentity.ts`（ID/URL/NAME）
- `package.json` name / scripts（`demo:di`）
- `vite.config.ts` port
- `LIST_demo/package.json` に `demo:di` 追加
- README

### 拡張時のフックポイント

| 知りたいこと | 場所 |
|--------------|------|
| Three canvas | `ExploreController.init` → `host.appendChild(renderer.domElement)`。App の `hostRef`（`.three-layer`） |
| Plane 管理配列 | `ExploreController` の `cards` / `imageMeshes` |
| userData | `{ imageId, imageUrl, currentAlpha, isImageCard }` |
| camera / renderer / scene | 同クラスの private フィールド。DI では getter を足すか Bubble 用モジュールに注入 |
| pointer 座標 | `onPointerDown/Move/Up`、NDC は `handleTap` |
| Raycaster | `handleTap` / `hitTestDiagnostics.runRaycastHitTest` |
| DOM UI 流用元 | `src/ui/*` + `motionConfig.ts`（DF 内コピーをそのまま継承で可） |
| Bubble を入れる場所 | **新規** `bubble` モジュール + RAF 内更新、または postprocess / 第2パス。pointer 追従は gesture と共存設計 |
| 触るべき | `exploreController`（render loop / pointer）、`sceneLayout`（必要なら定数）、`App` / `styles`（Bubble DOM）、visual/shader（カラー復帰） |
| 触ってはいけない | 本番 `app/`、既存 DF 本体、DB/DA/DD/DE を壊す変更、canvas を複数枚にする |

### Bubble 統合の注意

- 白黒は現状 **shader グレー化**（DOM 二重レイヤーではない）
- カラー復帰は「第2マテリアル / デュアルパス / マスク付きカラーテクスチャ」等が候補。Test_TRUNK の `clip-path` は参照体験であり、Three ではそのまま使えない
- Bubble UI は **screen 固定 DOM**（`pointer-events: none`）が仕様寄り
- Hit / pan / cruise を壊さないこと。Bubble 表示中の操作ポリシーは仕様書に従う

### 今回やらないこと（本レポート作成時点）

- DF の追加実装
- DE の修正
- Bubble 実装
- DI 作成
- 本番 `app` 反映

---

## 付録 A — 操作早見

| 操作 | 挙動 |
|------|------|
| ドラッグ | cameraX / cameraY |
| ホイール | cameraZ スクラブ（無限 wrap） |
| Shift+wheel 上 | ドリー潜り（慣性） |
| Shift+wheel 下 | ドリー引き |
| タップ | Raycaster → IMAGE_ZOOM |
| ハンバーガー | categoryDrawer |
| G / D | review ↔ debug |
| R | review |

## 付録 B — 設定ファイルの役割分担

| ファイル | 持つもの |
|----------|----------|
| `sceneLayout.ts` | カメラ・dolly・tap・hit alpha・配置・card motion |
| `motionConfig.ts` | IMAGE_ZOOM / drawer のみ |
| `visualConfig.ts` | fog / tint / noise / listAlpha presets |
| `imageSelection.ts` | 枚数 70・seed |
