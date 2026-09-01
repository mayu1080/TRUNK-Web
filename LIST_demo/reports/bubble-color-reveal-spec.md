# Bubble Color Reveal 仕様書

| 項目 | 内容 |
|------|------|
| 版 | 1.0 |
| 作成日 | 2026-07-11 |
| 目的 | 白黒画像空間内で指/カーソル周囲だけカラー復帰する演出を、将来 `PRODUCT_LIST` へ組み込むための仕様整理 |
| 対象ソース | `Test_TRUNK/`（`ai_playground/Test_TRUNK`）— L1 体験試作 |
| 本ドキュメントの範囲 | 仕様整理のみ。実装・描画方式の決定・本番反映は対象外 |
| 描画方式 | **未確定**（DOM / PixiJS / Three.js いずれも候補） |

> **重要**: 既存 Test 版の DOM / `clip-path` 実装は体験の参照実装であり、本番仕様として固定しない。

関連設定値の機械可読版: [`bubble-color-reveal-spec.json`](./bubble-color-reveal-spec.json)

---

## 1. 現在の実装概要（Test_TRUNK）

### 1.1 技術構成

| 項目 | 現状 |
|------|------|
| 構成 | 単一 `index.html`（HTML + CSS + インライン JS） |
| フレームワーク | なし（React なし） |
| 描画 | DOM 画像レイヤー ×2 + CSS `clip-path` + DOM バブル UI |
| 起動 | `serve` で静的配信（`npm run dev` → localhost:3000） |
| 画像 | 外部 picsum（ネット必須）。白黒/カラーで同一 URL を二重配置 |

### 1.2 画面構造

```text
#viewport          … 実画面（100vw × 100dvh, overflow:hidden）
  ├ #world         … 仮想空間（3000×1800px）
  │   ├ #bg-gray   … 白黒レイヤー（filter: grayscale(100%)）
  │   └ #color-layer … カラーレイヤー（clip-path で円形露出）
  └ #bubble        … シャボン玉 UI（viewport 直下・screen 固定）
```

### 1.3 レイヤー別の役割

#### 白黒レイヤー `#bg-gray`

- `#world` 内の全写真を常時表示
- `filter: grayscale(100%)` で白黒化
- `z-index: 1`
- 探索空間の「地」として常に見える

#### カラーレイヤー `#color-layer`

- 白黒レイヤーと**同一配置・同一画像**の複製
- 通常は `clip-path: circle(0px at 0px 0px)` で実質非表示
- バブル有効時のみ、円形 `clip-path` でカラーを露出
- `pointer-events: none`（操作を奪わない）
- `z-index: 2`

#### シャボン玉 UI `#bubble`

- viewport 座標系の DOM 円（`border-radius: 50%`）
- 見た目のみ（枠線・inset/outer glow・`backdrop-filter`）
- `pointer-events: none`
- 初期 `display: none`、表示時 `block`
- **仮想空間の transform の外**にあるため、ズームしても UI サイズは screen px 固定

#### clip-path / mask の考え方

```text
reveal 中心（world） = camera + screen / worldScale
reveal 半径（world） = (bubbleSize / 2) / worldScale

color-layer.clip-path = circle(radiusInWorld at worldX worldY)
```

- マスクは **カラーレイヤー側**に掛ける（白黒は全面）
- バブル UI 半径とカラー復帰半径は現状 **同一**（`bubbleSize / 2`）
- ズーム時は world 空間での半径を縮め、screen 上の見た目半径を一定に保つ

### 1.4 カメラ / ワールド

| 変数 | 意味 |
|------|------|
| `cameraX`, `cameraY` | ビューポート左上に対応する world 座標（原点は world 左上） |
| `worldScale` | ズーム倍率（既定 1、範囲 0.7〜2.4） |
| `#world` transform | `translate(-cameraX * scale, -cameraY * scale) scale(scale)`、`transform-origin: top left` |

カメラは world 境界内に clamp:

```text
maxCameraX = max(0, worldWidth - viewportWidth / worldScale)
maxCameraY = max(0, worldHeight - viewportHeight / worldScale)
```

### 1.5 pointer / touch 操作（実装済み）

**タッチのみ**（`mouse` / Pointer Events は未実装）。

| 操作 | 挙動 |
|------|------|
| 2本指 `touchstart` | 未表示ならバブル表示。中心に追従開始。ピンチ距離を記録 |
| 1本指 `touchmove`（バブル有効時） | 指位置へバブル + clip-path 更新 |
| 2本指 `touchmove` | ピンチ中心基準でズーム + バブルを中心へ更新 |
| 3本指 `touchstart`（バブル有効時） | バブル非表示・clip を 0 に戻す |
| `touchend` | 指が 2 本未満になったらピンチ距離リセット |
| 端オートパン | バブル表示中、画面端 12% 帯に入ると `requestAnimationFrame` でカメラ移動 |

共通:

- `touch-action: none`、`preventDefault` + `{ passive: false }`（iOS Safari 対策）
- ブラウザ標準ピンチズームは抑止し、独自 `zoomWorld` を使用

### 1.6 座標変換（実装）

```js
worldX = cameraX + screenX / worldScale
worldY = cameraY + screenY / worldScale
```

- `screenX/Y`: `touch.clientX/Y`（viewport ≈ window）
- バブル DOM: `left/top = screen - bubbleRadius`（screen 固定）
- clip-path 中心: 上記 world 座標
- clip 半径: `bubbleRadius / worldScale`

### 1.7 主要パラメータ（実装値）

| 名前 | 値 | 用途 |
|------|-----|------|
| `worldWidth` / `worldHeight` | 3000 / 1800 | 仮想空間サイズ |
| `minScale` / `maxScale` | 0.7 / 2.4 | ズーム範囲 |
| `bubbleSize` | 250 | UI 直径・reveal 直径（screen px） |
| `edgeThreshold` | `min(vw, vh) * 0.12` | 端オートパン判定帯 |
| `panSpeed` | `10 / worldScale` | 端スライド速度（world 単位/frame 相当） |

### 1.8 Test 版に無いもの（ギャップ）

- PC マウス / Pointer Events
- 1本指パン（空間ドラッグ）— 端オートパンのみ
- タップによる画像選択 / IMAGE_ZOOM
- 追従スムージング、非表示ディレイ、オフセット
- `revealRadiusPx` と `sizePx` の分離
- React / モジュール分割 / 設定 JSON 化
- 複数バブル、歪み、残像、物理泡

---

## 2. ユーザー体験仕様（技術非依存）

本番描画方式に依存せず、体験として満たすべき仕様。

### 2.1 基本体験

1. **通常時**、探索空間の画像は白黒（または同等の無彩色）で表示される
2. **指 / カーソルの周囲**にシャボン玉状の UI が表示される
3. **シャボン玉の内側だけ**、対応する画像領域の色が復帰する
4. シャボン玉は指 / カーソルに**追従**する
5. シャボン玉の外側は白黒のまま維持される
6. 空間のパン / ズーム中も、指位置とカラー復帰位置の対応が破綻しない

### 2.2 調整可能な体験パラメータ（意図）

| 体験項目 | 仕様 |
|----------|------|
| シャボン玉見た目サイズ | screen px で指定可能 |
| カラー復帰半径 | screen px で指定可能（見た目サイズと独立可） |
| 指からのオフセット | X/Y で指定可能（指の下を隠さない等） |
| 追従の滑らかさ | 即時〜スムーズ追従を設定可能 |
| 非表示タイミング | 明示操作、または無操作ディレイ |

### 2.3 操作を邪魔しないこと

- バブル UI はヒットを取らない（下の探索操作・タップ判定を阻害しない）
- カラー復帰レイヤーもポインターを奪わない
- バブル表示中でも、本番の tap / pan / pinch / drawer / IMAGE_ZOOM と**競合ルールを明示**できること（§3）

### 2.4 初期スコープ外（後工程）

| 項目 | 扱い |
|------|------|
| 複数シャボン玉 | 初期対象外 |
| 歪み / レンズ / 屈折 | 後工程 |
| 残像・軌跡 | 後工程 |
| 物理シミュレーション泡 | 後工程 |
| PC 専用ホバー演出の本番必須化 | しない（キオスクはタッチ主） |

### 2.5 体験上の成功条件（定性）

- 「指の周りだけ色が戻る」が一目で分かる
- ズームしても復帰円の見た目サイズが意図どおり（screen 基準 or 明示ルール）
- 端付近でも探索を続けられる（オートパン等）
- UI が操作判定を壊さない

---

## 3. 操作仕様

### 3.1 Test 版（現状）

| 環境 | 実装 |
|------|------|
| タッチ | あり（上記 §1.5） |
| PC マウス | **なし** |
| Pointer Events | **なし** |

### 3.2 PC / 開発環境（将来仕様案）

本番キオスクはタッチ主だが、開発・レビュー用に Pointer 対応を推奨。

| イベント | 推奨挙動（案） |
|----------|----------------|
| `pointermove`（バブル有効） | バブル追従 + reveal 更新 |
| `pointerdown` | 開発用: 表示トグル / または押下中のみ表示（要決定） |
| `pointerup` / `pointerleave` | 非表示 or `hideDelayMs` 後に非表示（要決定） |
| ホイール | Bubble 専用にしない。探索ズームと分離 |

Test 版の「2本指で表示 / 3本指で非表示」はタッチ向け。PC では別マッピングが必要。

### 3.3 タッチ本番想定

| ジェスチャ | Bubble との関係（推奨整理） |
|------------|------------------------------|
| **1本指 move（バブル有効）** | バブル追従。空間パンと同時にやるかは要決定 |
| **1本指 drag（バブル無効）** | 空間パン（PRODUCT_LIST 標準） |
| **2本指 pinch** | 空間ズーム。Test 版は同時にバブル中心追従 |
| **2本指 tap/start** | Test 版はバブル表示トリガー。本番では pinch 開始と衝突しやすい |
| **タップ（短時間・低移動）** | 画像ヒット → IMAGE_ZOOM。バブルは阻害しない |
| **スワイプ** | パン。バブル表示中の扱いを定義する |
| **3本指** | Test 版は非表示。本番で採用するかは要検討（誤爆・アクセシビリティ） |
| **バブル表示 / 非表示** | 明示ジェスチャ、常時表示、接触中のみ、のいずれか（未決） |

### 3.4 PRODUCT_LIST 操作との競合マトリクス

本番 `PRODUCT_LIST` で想定される操作と Bubble の関係。

| 操作 / UI | Bubble との関係 | 推奨方針 |
|-----------|-----------------|----------|
| **tap**（画像） | 競合しうる | バブルは `pointer-events: none`。タップ判定は探索レイヤ。短タップは ZOOM、長押し/移動はパン or バブル追従 |
| **drag / pan** | 競合しうる | Test 版はパン＝端オートパンのみ。本番は「1本指パン」と「バブル追従」の優先度を決める |
| **pinch** | 競合しうる | ピンチは探索ズーム優先。バブルは中心追従 or 一時固定 |
| **IMAGE_ZOOM** | 排他 | ZOOM 中は Bubble 停止・非表示。LIST 復帰で再開可 |
| **categoryDrawer** | 排他寄り | drawer open 中は Bubble 停止、または drawer 外のみ有効 |
| **bubble follow** | 常時候補 | LIST 探索中のみ。DETAIL / ZOOM / TOP / ANIMATION では無効 |
| **TRUNK ロゴ** | 無関係 | タップ不可のまま |

#### 競合を避けるための状態ゲート（案）

```text
bubbleAllowed =
  screenState === PRODUCT_LIST
  && categoryDrawer !== 'open'
  && !imageZoomOpen
  && bubbleConfig.enabled
```

### 3.5 Test 版操作モデル vs 本番モデル

| 項目 | Test_TRUNK | 本番 PRODUCT_LIST 想定 |
|------|------------|------------------------|
| 空間パン | 端オートパンのみ | 1本指ドラッグパンが主 |
| バブル表示 | 2本指 | 未決（常時 / 接触中 / トグル） |
| バブル非表示 | 3本指 | 未決 |
| 画像タップ | なし | IMAGE_ZOOM |
| drawer | なし | categoryDrawer |

→ Test 版のジェスチャ割当をそのまま本番固定しない。

---

## 4. 座標仕様

### 4.1 座標系の定義

| 名前 | 定義 | 備考 |
|------|------|------|
| **screen** | ビューポート上の CSS px（左上原点）。`clientX/Y` 相当 | バブル UI の配置基準 |
| **world** | 仮想探索空間の論理座標（左上原点） | 画像配置・clip 中心（DOM 版） |
| **camera** | ビューに写っている world の参照点 `(cameraX, cameraY)` | 「左上に見える world 点」 |
| **renderer** | Pixi/Three 内部の表示座標 | stage / camera projection 依存 |
| **worldScale** | screen と world の拡大率 | `screenΔ = worldΔ * worldScale`（DOM 版の定義） |

### 4.2 DOM 版（Test）の変換

```text
screen → world:
  world = camera + screen / worldScale

world → screen:
  screen = (world - camera) * worldScale

bubble UI (screen):
  left = screenX - sizePx/2 + offsetX
  top  = screenY - sizePx/2 + offsetY

reveal center (world):
  same as screen→world(finger + offset)

reveal radius (world):
  revealRadiusPx / worldScale
```

### 4.3 PixiJS 移植時に必要な変換

前提例: 探索コンテナ（または stage）が `position` + `scale` でカメラ相当を持つ。

```text
screen (viewport local)
  → Pixi の event / toLocal
  → world コンテナ局所座標 = reveal 中心

reveal 半径（world 単位）:
  revealRadiusPx / container.scale
  （または screen 空間で mask する場合は半径を screen のまま）
```

整理ポイント:

- **Bubble UI は DOM のまま screen 配置**がしやすい（Pixi 非依存）
- **reveal mask は Pixi 側**（Graphics mask / filter / shader）
- hit-test / tap 用の既存 `screen→world` と **同一関数を共有**すること
- 解像度・`resolution` / CSS サイズ差がある場合は `client` ↔ canvas 内部座標の補正が必要

### 4.4 Three.js 移植時に必要な変換

前提例: 画像が Plane Mesh、Perspective/Orthographic Camera で見る。

```text
screen (client)
  → NDC ( -1..1 )
  → Raycaster / unproject
  → 平面上の交点 = reveal 中心（world 3D）

または screen-space shader:
  reveal を fragment の UV/screen 円で行い、
  中心は pointer の NDC、半径は screen px → NDC 変換
```

整理ポイント:

- DOM バブルは screen のまま
- カラー復帰は **マテリアル/シェーダ** or 二重メッシュ + stencil/mask
- カメラ移動・FOV・アスペクト変化で「見た目半径一定」にするなら **screen-space 半径**が扱いやすい
- world 空間で半径固定にするとズームで見た目が変わる（意図の明示が必要）

### 4.5 指位置 → カラー復帰位置

共通パイプライン（推奨）:

```text
1. rawPointer (screen)
2. + offsetX/Y (screen)
3. optional smoothing → followPos (screen)
4. bubble UI を followPos に配置
5. followPos を renderer の world/UV/NDC に変換
6. reveal center / radius を描画系に渡す
```

Test 版は 1→4→5（オフセット・スムージングなし）、半径は `bubbleSize/2`。

---

## 5. パラメータ仕様

### 5.1 既存実装にある値

```js
// Test_TRUNK/index.html より
worldWidth = 3000
worldHeight = 1800
minScale = 0.7
maxScale = 2.4
bubbleSize = 250                    // UI直径 = reveal直径
edgeThresholdRatio = 0.12           // min(vw,vh) に乗算
panSpeedBase = 10                   // / worldScale
```

派生:

- `bubbleRadius = bubbleSize / 2`
- `revealRadius`（world）= `bubbleRadius / worldScale`
- 端オートパンはバブル表示中のみ常時 rAF

### 5.2 将来向け bubbleConfig（推奨）

```js
bubbleConfig = {
  enabled: true,
  sizePx: 250,              // シャボン玉 UI 直径（screen）
  revealRadiusPx: 125,      // カラー復帰半径（screen）。size と独立可
  offsetX: 0,               // 指からの UI/reveal オフセット
  offsetY: 0,
  followSmoothing: 0.18,    // 0=即時, 大きいほど滑らか（実装定義はデモで確定）
  hideDelayMs: 600,         // 離指後の残存（採用する場合）
  edgeAutoPanEnabled: true,
  edgeThresholdRatio: 0.12,
  // 以下は探索側と共有しうる関連値
  panSpeedBase: 10,
  minScale: 0.7,
  maxScale: 2.4
}
```

### 5.3 既存 vs 将来の区分

| パラメータ | 既存 | 将来推奨 | 備考 |
|------------|:----:|:--------:|------|
| `enabled` | △（常時ロジック組込） | ○ | 機能フラグ |
| `sizePx` / `bubbleSize` | ○ | ○ | 改名して config 化 |
| `revealRadiusPx` | ×（size と同一） | ○ | 見た目と復帰範囲の分離 |
| `offsetX/Y` | × | ○ | 指の下を隠さない等 |
| `followSmoothing` | ×（即時） | ○ | |
| `hideDelayMs` | ×（即時 hide） | ○ | PC/離指用 |
| `edgeAutoPanEnabled` | △（常時 ON） | ○ | |
| `edgeThresholdRatio` | ○ | ○ | |
| `panSpeedBase` | ○ | ○ | 探索設定側でも可 |
| `showGesture` / `hideGesture` | ハードコード | ○ | 2本指/3本指を固定しない |
| `activeOnlyWhileContact` | × | ○ | 接触中のみ表示か |
| `maxBubbles` | 1 固定 | 後工程 | 初期は 1 |
| `distortion` | × | 後工程 | |

機械可読版は `bubble-color-reveal-spec.json` を参照。

---

## 6. 描画方式ごとの実装案

同一の体験仕様に対し、実装が分岐する。**方式の結論は出さない。**

### A. DOM / clip-path 版（現行 Test）

**構成**

- 白黒画像レイヤー（`grayscale`）
- カラー画像レイヤー（同一 DOM 複製）
- `clip-path: circle(r at x y)` でカラー露出
- bubble DOM UI（screen）

**メリット**

- 実装が単純で体験検証が速い
- デバッグしやすい
- GPU 依存が相対的に低い（枚数が少ない場合）

**デメリット**

- 画像 40〜70 枚の二重 DOM は重い
- `clip-path` のブラウザ差（古い Android 等）
- 本番 LIST の WebGL 1 canvas 方針と乖離しやすい
- 奥行き・微モーションとの統合が弱い

**本番採用可能性**

- **体験プロトタイプ・仕様確認向き**
- 本番主描画としては非推奨寄り（枚数・性能・既存方針）
- 「Bubble 単体デモ」の参照実装としては有用

### B. PixiJS 版

**構成案**

- 通常: スプライトを白黒（tint / ColorMatrixFilter / 事前グレーテクスチャ等）
- カラー復帰:  
  - **案B1** カラー Texture を重ね、円形 `Graphics` mask  
  - **案B2** カスタム filter / shader で距離判定しカラーサンプル  
  - **案B3** レンダーテクスチャ + mask
- bubble UI: **DOM 推奨**（見た目・backdrop-filter を CSS で）
- 座標: 既存 explore の `screen→world` と共有

**メリット**

- 本番有力候補（Pixi 主 / Pixi+Three風）と同一スタック
- テクスチャ管理・大量画像と整合
- 1 canvas 原則を維持しやすい（UI は DOM）

**デメリット**

- mask / filter の fill rate・overdraw に注意
- グレー+カラー二重描画はコスト増
- shader 案は実装・保守コスト増

**本番採用時の注意点**

- ZOOM / drawer 中の更新停止
- `resolution` と CSS サイズの不一致
- 破棄時の filter / mask / texture リーク防止
- バブル UI を canvas 内に入れると hit-test と見た目の分離が難しくなる → DOM 分離推奨

### C. Three.js 版

**構成案**

- Plane（またはカード）Mesh。通常はグレースケール相当のマテリアル
- カラー復帰:  
  - **案C1** screen-space 円 mask を fragment shader で（白黒/カラー mix）  
  - **案C2** 二重 Plane + stencil / alpha mask  
  - **案C3** Raycaster で平面座標を求め、world 空間円で mix
- bubble UI: DOM
- 座標: projection / Raycaster または純 screen-space

**メリット**

- 質感・奥行き表現との一体感
- screen-space shader なら「見た目半径一定」が自然

**デメリット**

- 座標・カメラ更新が複雑
- 4面常設での Context Lost / 負荷リスク
- DOM Bubble と 3D の同期ずれに注意

**本番採用時の注意点**

- LIST 主レンダラーを Three にする判断とセット（Bubble 単体では決めない）
- Orthographic の方が 2D 探索には単純な場合あり
- 深度・半透明・ノイズパスとの合成順

### 方式比較（判断用）

| 観点 | DOM clip-path | Pixi | Three |
|------|:-------------:|:----:|:-----:|
| Test 版との近さ | ◎ | △ | △ |
| 大量画像 | × | ◎ | ○ |
| 1 canvas 方針 | △ | ◎ | ◎ |
| 実装速度（Bubble 単体） | ◎ | ○ | △ |
| 本番統合しやすさ | △ | ◎（Pixi採用時） | ◎（Three採用時） |

---

## 7. 実装しないこと（本仕様作業の境界）

本ドキュメント作成時点で、以下は行わない / 行っていない。

- 新規実装コードの追加
- 既存 DF / DD / DE デモの変更
- 本番 `app/` への反映
- 描画方式（Pixi vs Three vs DOM）の決定・結論付け
- 複数シャボンの実装
- 歪み表現の実装
- 画像素材の加工・差し替え

---

## 8. 最終的に欲しい判断材料

### 8.1 Pixi 採用時に必要な Bubble 実装

- screen↔Pixi world の共有変換
- 白黒表示パス + カラー復帰パス（mask または shader）
- DOM バブル UI（追従・サイズ・非ヒット）
- LIST 状態ゲート（ZOOM / drawer / screenState）
- パフォーマンス計測（二重描画・filter コスト）

### 8.2 Three 採用時に必要な Bubble 実装

- screen↔world（Raycaster または screen-space shader）
- マテリアルでのグレー/カラー mix
- DOM バブル UI
- カメラ移動・ズームと半径の見た目ルール
- 同様の状態ゲートと FPS / Context 安定性確認

### 8.3 共通で使える仕様

- 体験仕様（§2）
- 操作競合ルール・状態ゲート（§3.4）
- `bubbleConfig` パラメータ意味（§5）
- screen 基準の UI サイズ / reveal 半径 / オフセット
- 「UI は DOM、復帰は描画層」の分離方針
- 端オートパンの体験意図（実装はカメラ API に合わせる）

### 8.4 使い回せない実装（Test 版固有）

- 二重 `<img>` DOM + `clip-path`
- 2本指表示 / 3本指非表示のハードコード
- 端オートパンのみのパンモデル（1本指空間パンなし）
- picsum 外部画像前提
- 単一 `index.html` 構造そのもの
- React なし前提のイベント配線

### 8.5 先に決めるべき未決事項

1. **主描画方式**（Pixi / Three / その他）— Bubble 実装の分岐点
2. **reveal の見た目半径ルール**（常に screen 一定か、world 一定か）
3. **表示トリガー**（常時 / 接触中のみ / ジェスチャトグル）
4. **1本指**: パン優先かバブル追従優先か、併存ルール
5. **`sizePx` と `revealRadiusPx` を分けるか**
6. **端オートパンを本番でも採用するか**（標準パンとの関係）
7. **PC 開発用 Pointer 挙動**を公式サポートするか

### 8.6 本番組み込み前に作るべき Bubble 単体デモの範囲

推奨スコープ（描画方式は主レンダラー候補に合わせて 1 本、または Pixi/Three 並走）:

| 含める | 含めない |
|--------|----------|
| 白黒空間 + 単一バブルカラー復帰 | 複数バブル |
| DOM バブル UI | 歪み・物理泡・残像 |
| screen↔world 変換の可視化デバッグ | IMAGE_ZOOM / drawer 本実装（スタブでゲートのみ可） |
| `bubbleConfig` のライブ調整 | 本番 assetIndex 本接続（少数ローカル画像で可） |
| 1本指追従 + ピンチズームとの共存確認 | 4面同期 |
| 端オートパン ON/OFF | 音 |
| FPS / ざっくり負荷表示 | 本番 app 統合 |

**ゴール**: 「体験仕様が描画スタック上で成立するか」と「操作競合の仮ルールが破綻しないか」を確認し、本番組み込み工数を見積もれる状態にする。

---

## 付録 A. 参照ファイル（読了）

| パス | 内容 |
|------|------|
| `Test_TRUNK/README.md` | Bubble Color Reveal 概要・操作・パラメータ |
| `Test_TRUNK/index.html` | 実装本体（HTML/CSS/JS） |
| `Test_TRUNK/package.json` | `serve` による静的起動 |
| `TRUNK_delivery/docs/handover.md` | 試作のバブル clip-path 言及・流用可否 |
| `TRUNK_delivery/docs/architecture.md` | PRODUCT_LIST / ZOOM / drawer 前提 |
| `TRUNK_delivery/LIST_demo/reports/product-list-demo-strategy.md` | LIST 描画方針（方式未決の文脈） |

## 付録 B. Test 版操作チートシート

| 操作 | 結果 |
|------|------|
| 2本指タッチ | バブル表示 |
| 1本指ドラッグ | バブル移動 + カラー露出追従 |
| 2本指ピンチ | 空間ズーム（中心固定）+ バブルを中心へ |
| 画面端へバブル | 仮想空間オートスライド |
| 3本指 | バブル非表示 |
