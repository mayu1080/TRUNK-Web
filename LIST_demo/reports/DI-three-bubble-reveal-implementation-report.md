# DI Three Bubble Reveal — 実装レポート

| 項目 | 内容 |
|------|------|
| 版 | 1.0 |
| 作成日 | 2026-07-11 |
| 対象 | `LIST_demo/demos/DI-three-bubble-reveal` |
| 目的 | 本番 `PRODUCT_LIST` へ戻る前に、DI の Bubble 統合内容・方式・限界を引き継ぐ |
| 本ドキュメントの範囲 | **ドキュメントのみ**。本番 `app` 反映・DF/DE/DD/DB/DA 変更・新機能追加は対象外 |

機械可読版: [`DI-three-bubble-reveal-implementation-report.json`](./DI-three-bubble-reveal-implementation-report.json)

関連:

- Bubble 仕様: [`bubble-color-reveal-spec.md`](./bubble-color-reveal-spec.md)
- DF 実装: [`DF-three-camera-depth-implementation-report.md`](./DF-three-camera-depth-implementation-report.md)
- DE / DF 比較: [`DE-vs-DF-comparison-report.md`](./DE-vs-DF-comparison-report.md)

---

## 1. デモ概要

| 項目 | 内容 |
|------|------|
| デモ名 | **DI-three-bubble-reveal**（`DEMO_ID = 'DI'`） |
| 表示名 | DI \| Three Bubble Reveal |
| URL | http://localhost:5178/ |
| ポート | **5178**（`strictPort: true`） |
| 起動 | `cd LIST_demo && npm run demo:di` |
| 代替起動 | `cd LIST_demo/demos/DI-three-bubble-reveal && npm install && npm run demo:di` |
| 実装目的 | DF の Three.js カメラ空間に **Bubble Color Reveal** を統合し、「白黒空間の中で指/カーソル周囲だけ色が戻る」体験が成立するかを検証する |
| ベース | **`DF-three-camera-depth` をコピー**（DF 本体は変更していない） |
| canvas | **1枚**（`WebGLRenderer.domElement`） |

### DF から引き継いだ機能

- Three.js `PerspectiveCamera` + fog + Plane Mesh（約70枚）
- drag（cameraX/Y）/ wheel（cameraZ 無限 wrap）/ Shift+wheel dolly cruise
- Raycaster tap → IMAGE_ZOOM
- categoryDrawer / Review・Debug / visual preset / Hit debug overlay
- DOM UI（framer-motion）・noise / vignette

### Bubble として追加した機能

- DOM シャボン玉 UI（一重の細い円 + SVG 楕円 glint 周回）
- screen-space shader によるカラー復帰（円内だけカラー）
- Pointer Events 追従・平滑化・hideDelay・状態ゲート
- Debug の `bubble motion` プルダウン（`elegant` / `off`）
- DI のみ tap 閾値・hit alpha を緩和

### 現在の完成度

| 項目 | 状態 |
|------|------|
| DF カメラ操作の維持 | **成立** |
| DOM Bubble UI + 追従 | **成立**（PC Pointer レビュー向け） |
| カラー復帰（shader） | **成立** |
| Raycaster / IMAGE_ZOOM | **維持** |
| drawer / Review Mode ゲート | **実装済み** |
| 縁ライン elegant motion（呼吸 + 対岸2点 glint） | **実装済み** |
| タッチ本番ジェスチャ / 端オートパン / 複数バブル | **未実装**（意図的スコープ外） |

### 現在の体感（主観込み）

- **DF のカメラ操作は維持できている** — drag / wheel / dolly のぬるさは DF と同系。Bubble は pointer を奪わない
- **Bubble UI 追従は自然** — `followSmoothing: 0.18` でわずかに遅れるが、ラグジュアリー寄りで許容範囲。ホバー移動でも表示される（`showOnPointerMove`）
- **カラー復帰は成立している** — 白黒空間の中で円内だけ色が戻る体験が一目で分かる。縁はハード寄りで添付リファレンスに近い
- **Raycaster / IMAGE_ZOOM は壊れていない** — Bubble は `pointer-events: none`。tap 閾値は DI でやや緩和（16px / 600ms / alpha 0.10）し、渋さは DF より改善方向
- **FPS・操作感の悪化は限定的** — 追加は共有 uniforms + fragment mix と DOM/SVG。体感上、DF 比で大きな落ち込みは感じにくい（環境依存。Debug FPS で確認推奨）
- 縁の楕円 glint（対岸2点）は静かで上品。長い trail は採用していない

---

## 2. 変更・追加したファイル一覧

### 2.1 デモ本体 `LIST_demo/demos/DI-three-bubble-reveal/`

DF コピーを起点に、以下を **DI 向けに追加・変更**。

| ファイル | 役割 | 主な処理 | 流用 / 追加 |
|----------|------|----------|-------------|
| `package.json` | npm | `demo:di`、port 系は vite | DI 改名 |
| `vite.config.ts` | Vite | **port 5178**、`/content` | DF 流用→port 変更 |
| `index.html` | 入口 | title DI | 変更 |
| `README.md` | 説明 | 起動・Bubble 要約 | DI 新規文 |
| `scripts/copy-demo-index.mjs` | 索引コピー | DB → public | DF 流用（ログ DI） |
| `src/demoIdentity.ts` | 識別子 | DI / 5178 / 表示名 | **DI 追加定義** |
| `src/bubbleConfig.ts` | Bubble 定数 | size/reveal/motion presets | **DI 新規** |
| `src/three/bubbleRevealShader.ts` | カラー復帰 | `onBeforeCompile` + shared uniforms | **DI 新規** |
| `src/three/exploreController.ts` | 中核 | DF + Bubble pointer / uniforms / gates | DF 流用→**DI 拡張** |
| `src/three/sceneLayout.ts` | 定数 | tap/hit **緩和** | DF 流用→DI のみ変更 |
| `src/types.ts` | 型 | DebugStats に Bubble 項目 | DF 流用→拡張 |
| `src/App.tsx` | 骨格 | BubbleOverlay / motion トグル配線 | DF 流用→拡張 |
| `src/ui/BubbleOverlay.tsx` | DOM Bubble | SVG 円 + glint×2 + dust | **DI 新規** |
| `src/ui/DebugPanel.tsx` | HUD | Bubble / NDC / motion 表示 | DF 流用→拡張 |
| `src/ui/DemoToggles.tsx` | トグル | **bubble motion** select | DF 流用→拡張 |
| `src/ui/DemoBanner.tsx` | バナー | DI 表示名 | 変更 |
| `src/styles.css` | スタイル | Bubble SVG / drawer 中央寄せ（DF 準拠） | 拡張 |
| その他 `src/ui/*`, asset, visual, motion… | DF 同等 | IMAGE_ZOOM / drawer / noise 等 | **ほぼ流用** |

### 2.2 LIST_demo 配線

| ファイル | 役割 |
|----------|------|
| `LIST_demo/package.json` | `"demo:di"` 追加 |
| `LIST_demo/README.md` | DI 行（5178）追加 |

### 2.3 触っていないもの（明示）

- `app/`（本番）
- **`DF-three-camera-depth` 本体**
- DB / DA / DD / DE のソース本体（索引生成で DB を呼ぶのみ）

---

## 3. DF から引き継いだ構成

| 構成 | DI での扱い | DF 比の変更 |
|------|-------------|-------------|
| Scene + FogExp2 | 維持 | なし |
| PerspectiveCamera（fov 52 等） | 維持 | なし |
| WebGLRenderer（1 canvas） | 維持 | なし |
| PlaneGeometry + TextureLoader | 維持 | なし |
| MeshBasicMaterial | 維持 | **shader を Bubble reveal 付きに置換** |
| Raycaster tap | 維持 | 閾値・alpha のみ緩和 |
| drag / wheel / dolly cruise | 維持 | なし |
| IMAGE_ZOOM / categoryDrawer | 維持 | drawer CSS を DF の中央寄せに揃えた |
| Review / Debug | 維持 | Bubble UI は Review でも表示。Debug 数値は隠す |
| visual preset / Hit debug | 維持 | + bubble motion トグル |

---

## 4. Bubble 実装方式

### 方式選択

**候補A: Three material / screen-space shader** を採用。

理由:

- DF 既存の `onBeforeCompile` グレースケールを拡張できる
- mesh 数を増やさない（dual-plane 不要）
- 見た目半径を **screen px 固定**にしやすい
- DOM clip-path（Test_TRUNK）は移植しない方針に合致

### DOM Bubble UI 構造

```text
.bubble-overlay                 (position:fixed, pointer-events:none)
  └ svg.bubble-overlay__svg     (viewBox 0 0 100 100)
       ├ circle.base            … 一重の細い白円
       └ g.glint-orbit          … 7.5s 回転
            ├ ellipse glint A   … 東端・接線方向の楕円反射
            ├ dust ×3（近傍）
            ├ ellipse glint B   … 対岸・西端（やや控えめ）
            └ dust ×2
```

| 項目 | 実装 |
|------|------|
| SVG | **使用**（基線円 + 楕円 glint + dust） |
| CSS animation | **使用**（呼吸 scale、glint orbit 7.5s、dust 軟点滅） |
| Framer Motion | Bubble UI には**未使用**（ZOOM/drawer のみ） |
| 表示/非表示 | `visible && allowed`。opacity/visibility。`hideDelayMs: 600` |
| 追従 | ExploreController が target 更新 → RAF lerp → BubbleOverlay が rAF で style 反映 |
| followSmoothing | **0.18**（毎フレーム lerp 係数） |
| sizePx | **320** |
| revealRadiusPx | **160**（直径と一致） |
| offsetX/Y | **0** |
| pointer-events | overlay **`none`**（操作を奪わない） |
| motion プリセット | `elegant`（既定）/ `off`（静的円のみ） |

---

## 5. カラー復帰処理（最重要）

### 通常の白黒表示

各 Plane の `MeshBasicMaterial` に `attachBubbleRevealShader` を適用。

`map_fragment` 後:

1. 元カラー `colorSample` を保持
2. luma `gray = dot(rgb, 0.299/0.587/0.114)` で白黒化
3. screen-space 距離に応じて `mix(gray, color, reveal)`

（DF は常時グレーのみ。DI は同一パスで mix。）

### Bubble 範囲のカラー復帰

| 項目 | 内容 |
|------|------|
| 方式 | **shader**（screen-space 円 mask） |
| 不採用 | dual-plane / Raycaster 交点 world 円 / DOM clip-path |
| uniforms（全 mesh 共有） | `uRevealCenterNdc`, `uRevealRadiusPx`, `uResolution`, `uRevealActive` |
| 中心計算 | 平滑化後の `bubbleScreenX/Y` → canvas `getBoundingClientRect` → NDC |
| 半径 | **screen 固定**（CSS px × `pixelRatio` → drawing-buffer px） |
| fragment 距離 | `length((fragNdc - centerNdc) * resolution * 0.5)` |
| 縁 | ほぼハード（`edge ≈ 1.0` px） |

### なぜ shader か

- DF 安定性を壊しにくい（mesh 増なし）
- ズーム/dolly しても見た目半径が一定
- 複数 Plane をまたいでも「画面上の円」として一貫（world 円より体験意図に合う）

### camera 移動時のズレ

中心は毎フレーム screen→NDC で更新するため、**カメラ移動しても DOM 円と shader 円は同一 screen 基準**で追従する。world 空間に固定していないので、ズームで半径が膨らむ問題は起きにくい。

### 複数 Plane をまたぐ見え方

同一 screen 円が全 mesh の fragment に効く。手前・奥の Plane が円内に入っていれば、それぞれカラー復帰する（奥行きに関係なく「窓」として見える）。これは体験上望ましい。

### 既知の限界

- `onBeforeCompile` 依存（Three バージョンアップで shader 文字列差分リスク）
- 低 alpha / fog 下のトーンは DF 同様の制約
- 半径は CSS×pixelRatio 近似。極端な CSS/canvas 不一致時は要確認
- タッチ本番の表示トリガー（2本指等）は未実装

---

## 6. Pointer / 操作競合

| 操作 | Bubble | 探索 |
|------|--------|------|
| pointermove | UI 追従 + reveal 中心更新（`showOnPointerMove`） | 押下中のみ drag |
| pointerdown | 表示・contact | capture + tap 計測開始 |
| pointerup | `hideDelayMs` 後に非表示 | tap 判定 → Raycaster |
| pointerleave | fade（hideDelay） | 押下中なら pointerup 相当 |
| drag | 併存（Bubble は追従し続ける） | cameraX/Y |
| wheel / dolly | Bubble 専用処理なし | DF と同じ |
| IMAGE_ZOOM open | **停止・非表示**（`bubbleAllowed=false`） | interaction off |
| drawer open | **停止・非表示** | interaction off |
| Review Mode | Bubble UI + カラー復帰は**見える**。Debug HUD は隠す | 操作は通常どおり |

状態ゲート:

```text
bubbleAllowed =
  bubbleConfig.enabled
  && !imageZoomOpen
  && !drawerOpen
  && (activeOnlyInList 前提 — DI では LIST 相当の通常画面のみ)
```

---

## 7. Hit 判定への影響

| 項目 | DI |
|------|-----|
| 流れ | pointerup → move/duration 判定 → `handleTap` → NDC → Raycaster → `onImageTap` → IMAGE_ZOOM | **DF と同じ** |
| Bubble が pointer を奪うか | **奪わない**（`pointer-events: none`） |
| tapMaxMovePx | **16**（DF: 12） |
| tapMaxDurationMs | **600**（DF: 500） |
| hitTestMinAlpha | **0.10**（DF: 0.18） |
| selectedImageId | mesh.userData.imageId をセット | 同左 |
| IMAGE_ZOOM | App の `setIsImageZoomOpen(true)` | 同左 |
| Bubble 表示中の tap | 自然に可能（短い移動は tap、長い移動は drag） | 体感良好寄り |

---

## 8. Debug panel 項目

既存 DF 項目に加え Bubble 系を表示:

- FPS / canvas count / image mesh count / texture count
- camera / target / timeline / dolly cruise / fov
- visual preset / hit debug
- raycast candidates / chosen imageId / distance / selectedImageId
- overlay open / drawer open / interaction / overlayState
- **bubble enabled / visible / bubbleAllowed**
- **bubble motion**（トグル選択名）
- **bubble screenX / screenY**
- **sizePx / revealRadiusPx**
- **reveal mode**（`shader`）
- pointer type / imageZoomOpen
- reveal active / reveal center NDC / uniforms 要約

Demo トグル: visual preset / **bubble motion** / ui mode / hit test / ZOOM backdrop / drawer scrim

---

## 9. パフォーマンス・体感

| 項目 | 現状メモ |
|------|----------|
| FPS | 通常 60 前後を狙える想定（Debug 表示）。GPU・枚数依存 |
| 画像枚数 | **約 70**（`TARGET` / SCENE_LAYOUT） |
| canvas | **1** |
| mesh / texture | カード数と概ね同数（約70） |
| Bubble ON/OFF | motion off は DOM 装飾のみ減。shader は enabled/active で mix 停止可能。負荷差は小さい想定 |
| wheel / drag | DF 同等の滑らかさ |
| pointer 追従 | smoothing 0.18 でやや遅延。高級感寄り |
| Raycaster | 閾値緩和により DF より渋さが減る方向 |
| Console | テクスチャ失敗は warning。致命的エラーは基本なし想定 |
| Context Lost | 明示ハンドラは薄い（DF 同様・要監視） |
| 重い処理 | 起動時逐次 `loadAsync`、毎フレーム card motion + reveal uniforms 更新 |

---

## 10. 既知の問題

1. **タッチ本番未検証** — Pointer ベースだが、2本指表示・ピンチ同時・端オートパンは未実装
2. **ホバー後 hideDelay** — pointerup / leave 後 600ms で消え、再移動で再表示（PC レビュー用の仮仕様）
3. **followSmoothing によるわずかな遅れ** — DOM と reveal は同一平滑座標だが、即時追従ではない
4. **shader 保守コスト** — Three 内部 shader 差分に弱い
5. **billboard なし**（DF 継承）— 大きくパンすると平面側面が見える
6. **テクスチャ逐次ロード** — 起動時待ち・失敗 skip
7. **PRODUCT_DETAIL 未接続** — drawer 選択はデモ内ステートのみ
8. **4面同期 / 10分スリープ** — デモ対象外
9. **edgeAutoPan** — 仕様にあるが DI 未実装
10. **複数シャボン / 歪み / 物理泡** — スコープ外

---

## 11. 本番 PRODUCT_LIST へ移植する場合の設計メモ

### 移植すべき機能

- screen-space shader によるグレー + 円内カラー復帰
- DOM Bubble UI（一重円 + 控えめ glint）。`pointer-events: none`
- `bubbleConfig`（size / revealRadius / smoothing / hideDelay / gates）
- `bubbleAllowed` ゲート（LIST のみ、ZOOM/drawer 中停止）

### DI のまま使えるコード（概念・モジュール単位）

- `bubbleRevealShader.ts` の考え方（shared uniforms + mix）
- `bubbleConfig` のパラメータ意味
- BubbleOverlay の DOM/SVG 分離方針

### 書き換えるべきコード

- ExploreController 相当を本番 LIST レンダラに合わせる（Pixi 採用なら別実装）
- asset 読込を本番 `assetIndex` / `getContentFileUrl` に接続
- UI を本番 screenState / categoryDrawer / IMAGE_ZOOM に接続
- Review/Debug トグルは本番不要または開発ビルド限定

### 接続点

| 本番要素 | 接続 |
|----------|------|
| content 読込 | Renderer は `assetIndex` のみ。DI の Vite `/content` は試作用 |
| screenState | `PRODUCT_LIST` のみ Bubble 有効。TOP/ANIMATION/DETAIL/ZOOM では無効 |
| 10分無操作 | LIST 離脱（TOP 復帰）で Bubble 停止・破棄。タイマーリセット対象に pointer を含めるか要確認 |
| 4面同期 | LIST 以降は面独立。Bubble 状態は同期しない（ローカル pointer） |
| categoryDrawer | open 中は Bubble 停止（DI と同じ） |
| IMAGE_ZOOM | open 中は停止。閉じて LIST 復帰で再開可 |
| TRUNK ロゴ | 無関係（タップ不可のまま） |

### 本番で未実装のまま残してよいもの（当面）

- 複数シャボン、歪み、物理泡、長い trail
- Debug / visual preset / hit overlay
- Test_TRUNK の 2本指/3本指ジェスチャ（本番は別マッピングで再設計）

### レンダラ未決への注意

本番主描画が **Pixi** になった場合、DI の Three shader はそのまま使えない。体験仕様・config・DOM Bubble・ゲートは流用し、**reveal 実装だけ Pixi filter/mask に差し替え**る必要がある。Three 採用なら DI 方式が最短。

---

## 12. 本番移植前の合格判定

```text
判定: 条件付き合格
```

### 理由

**進めてよい点**

- DF 空間に Bubble を載せ、「白黒 + 円内カラー復帰」が一目で成立している
- 1 canvas・約70 Plane・カメラ操作・Raycaster/ZOOM を維持
- DOM UI が操作を奪わない。ZOOM/drawer ゲートあり
- screen px 固定半径でカメラ移動と整合

**条件（移植前に詰める／本番設計で決めること）**

1. 主描画が Pixi か Three かの確定（方式分岐）
2. タッチ本番の表示トリガー・1本指パンと Bubble の優先度
3. 55インチ縦実機での sizePx / revealRadius / glint 視認性の最終調整
4. Context Lost・長時間稼動の監視方針

→ **体験検証デモとしては合格。本番直結コードとしては条件付き**（上記を踏まえて設計に進む）。

---

## 付録 A — 操作早見

| 操作 | 挙動 |
|------|------|
| ポインタ移動 | Bubble 追従 + カラー復帰 |
| ドラッグ | cameraX / cameraY |
| ホイール | cameraZ（無限 wrap） |
| Shift+ホイール | dolly cruise |
| タップ | Raycaster → IMAGE_ZOOM |
| ハンバーガー | categoryDrawer（縦中央ボタン） |
| G / D | review ↔ debug |
| R | review |
| bubble motion | elegant / off |

## 付録 B — 主要設定値

| キー | 値 |
|------|-----|
| sizePx | 320 |
| revealRadiusPx | 160 |
| followSmoothing | 0.18 |
| hideDelayMs | 600 |
| revealMode | shader |
| default bubble motion | elegant |
| tapMaxMovePx | 16 |
| tapMaxDurationMs | 600 |
| hitTestMinAlpha | 0.10 |
| glint orbit | 7.5s |
| breath | 3.6s / scale ≈ 1.028 |
