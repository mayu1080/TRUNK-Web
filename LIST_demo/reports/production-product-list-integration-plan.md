# 本番 PRODUCT_LIST 移植計画書

| 項目 | 内容 |
|------|------|
| 版 | 1.0 |
| 作成日 | 2026-07-11 |
| 目的 | `DI-three-bubble-reveal` の知見を本番 `PRODUCT_LIST` へ移植する手順・接続・リスク・未決を整理する |
| 本ドキュメントの範囲 | **計画書のみ**。`app/` 実装・DI/DF コード変更・PRODUCT_DETAIL 本実装は対象外 |
| 前提デモ | `LIST_demo/demos/DI-three-bubble-reveal`（DF コピー + Bubble） |
| DI 判定 | **条件付き合格**（体験成立。本番直結前に未決あり） |

機械可読版: [`production-product-list-integration-plan.json`](./production-product-list-integration-plan.json)

関連:

- [`DI-three-bubble-reveal-implementation-report.md`](./DI-three-bubble-reveal-implementation-report.md)
- [`DF-three-camera-depth-implementation-report.md`](./DF-three-camera-depth-implementation-report.md)
- [`bubble-color-reveal-spec.md`](./bubble-color-reveal-spec.md)
- [`DE-vs-DF-comparison-report.md`](./DE-vs-DF-comparison-report.md)
- [`product-list-demo-strategy.md`](./product-list-demo-strategy.md)
- `docs/architecture.md` / `docs/screen-flow.json` / `app/README.md`

---

## 1. 移植方針

### 結論（大方針）

| 問い | 方針 |
|------|------|
| DI を本番にそのままコピーするか | **しない** |
| どう進めるか | **本番 PRODUCT_LIST 用に再構成**（モジュール抽出 + screenState / content / idle / 同期へ接続） |
| Three.js を本番主描画にする前提か | **前提にしない（未決）**。DI は Three 候補の検証成果。本採用は別ゲートで確定する |

### DI をそのままコピーしない理由

- DI は Vite 単体デモ。本番は Electron Main + preload + 4 BrowserWindow
- 画像は Vite `/content` middleware ではなく、起動時 `assetIndex` + `getContentFileUrl`
- 画面は `screenState` / `categoryDrawer` / 無操作スリープ / 4面同期と一体
- Review / Debug / visual preset は本番 UI に載せない（開発ビルド限定）
- `ExploreController` 巨大クラスをそのまま置くと責務が崩れる

### Three.js 本採用についての位置づけ

| ソース | 位置づけ |
|--------|----------|
| `product-list-demo-strategy.md` | Pixi 主 / Pixi+Three風が有力。Three 主は**表現上限確認・条件付き** |
| `docs/architecture.md` | PRODUCT_LIST 描画方式は**未決**。Phase 2 では触らない |
| DI / DF / DE 比較 | 体験満足度・空間感では DF/DI（Three）が強い。4面安定性・保守では Pixi 系が有利な可能性 |

**本計画書の扱い**

1. **パス A（Three 本採用）**: DI の scene / camera / Raycaster / screen-space reveal を本番 LIST の核にする  
2. **パス B（Pixi 本採用）**: DI の **体験仕様・Bubble DOM・config・状態ゲート** を流用し、reveal / 探索描画は Pixi で再実装  

どちらのパスでも、**DOM Bubble + `bubbleConfig` + ZOOM/drawer ゲート**は共通資産になる。

### DF / DI デモと本番の違い

| 観点 | DF / DI | 本番 |
|------|---------|------|
| ランタイム | Vite 単窓 | Electron 4 window |
| 画像 | demo-asset-index + `/content` | Main `assetIndex` + preload URL |
| 状態 | React ローカル | `screenState` + Main 協調 |
| 無操作 | なし | 10分・当該面のみ TOP |
| 同期 | なし | TOP→ANIMATION→LIST のみ4面 |
| UI | デモ用 ZOOM/drawer | 本番遷移・PRODUCT_DETAIL 接続 |
| Debug | G/D Review | 本番非表示（開発のみ） |
| タッチ | PC Pointer 中心 | 55インチ縦タッチ主 |

---

## 2. 本番に移植する機能

優先度付き。

| 機能 | 移植 | 備考 |
|------|:----:|------|
| Three.js 写真空間 | △ | **パス A のみ**。パス B では Pixi 空間に置換 |
| camera drag / dolly（wheel/pinch 相当） | ○ | 操作モデルは本番タッチへ翻訳 |
| Raycaster hit（または同等 hit） | ○ | Three なら Raycaster。Pixi なら bounds/hit 再設計 |
| IMAGE_ZOOM 連携 | ○ | `screenState: IMAGE_ZOOM`、×→常に LIST |
| DOM UI（ZOOM / drawer / hamburger） | ○ | DI/DF/DA 系を本番コンポーネントへ |
| Bubble UI（DOM SVG） | ○ | `pointer-events: none` 維持 |
| Bubble color reveal | ○ | Three shader（A）または Pixi mask/filter（B） |
| Review / Debug Mode | △ | **本番顧客 UI には載せない**。開発ビルドのみ |

**必須体験（描画スタック非依存）**

1. 通常は白黒（または同等無彩色）の写真空間  
2. 指周囲にシャボン玉 UI  
3. 円内だけカラー復帰（screen px 基準推奨）  
4. pan / zoom / tap→ZOOM が壊れない  
5. ZOOM / drawer / LIST 外では Bubble 停止  

---

## 3. 本番でそのまま使えるもの

「ファイル丸ごとコピー」ではなく、**概念・モジュール単位の流用**。

### 高流用（ほぼそのまま / 薄いラッパ）

| DI 資産 | 本番での使い方 |
|---------|----------------|
| `bubbleConfig.ts` の意味・既定値 | 本番 `config/bubble.ts` へ移植。値は実機で再調整 |
| Bubble 状態ゲート | `screenState===PRODUCT_LIST && drawer!==open && !IMAGE_ZOOM` |
| `BubbleOverlay` の DOM/SVG 方針 | Renderer の LIST 上に配置。CSS は本番デザイントークンへ |
| elegant glint（対岸2点・trailなし） | 見た目資産として流用可 |
| IMAGE_ZOOM / drawer の Motion 定数思想 | `motionConfig` 相当を本番 UI に合わせる |
| tap 閾値緩和の知見 | 16px / 600ms / alpha 0.10 を初期値候補に |

### 中流用（パス A で有効）

| DI 資産 | 注意 |
|---------|------|
| `bubbleRevealShader.ts` | Three 採用時。Three 版差分に注意 |
| camera / dolly / sceneLayout 定数 | 実機画角・FOV で再チューニング |
| Raycaster 流れ | preload URL テクスチャ上でも同様 |
| ExploreController の pointer→NDC→reveal | 分割して本番サービスへ |

### 低流用 / 使わない

| DI 資産 | 理由 |
|---------|------|
| Vite `/content` middleware | 本番は preload |
| DemoBanner / DebugPanel / DemoToggles | 顧客 UI 非対象 |
| `demoIdentity` / ポート | デモ専用 |
| Test_TRUNK DOM clip-path | 仕様でも非推奨 |

---

## 4. 本番用に書き換えるもの

| 領域 | DI / デモ | 本番 |
|------|-----------|------|
| asset 読込 | `loadListImages` + JSON fetch | `getAssetIndex()` → `listImages` |
| 画像 URL | `/content/...` | `getContentFileUrl(relativePath)` |
| 枚数 | demo の 70 cap / duplicate | Main 選定済み listImages（40〜70） |
| screenState | なし（常時 LIST） | LIST 入場で init、離脱で dispose |
| categoryDrawer | React ローカル | `uiState.categoryDrawer` + transitions |
| IMAGE_ZOOM | ローカル boolean | `IMAGE_ZOOM` action / close → LIST |
| 無操作スリープ | なし | pointer/pan/pinch/tap で idle reset。TOP 復帰で Three/Pixi dispose |
| 4面同期 | なし | LIST 到達後は面独立。Bubble 状態は同期しない |
| Review/Debug | 既定 review | 本番は常時「review相当」。debug は `NODE_ENV`/フラグ |
| config | ソース定数 | 可能なら JSON / ビルド時 config（現場調整しやすく） |

---

## 5. 既存本番機能との接続

現状 `app/` は **content 層・状態遷移・idle の骨格**があり、**PRODUCT_LIST 描画 UI は未実装**（`app/README.md`）。

```text
TOP ──(全台TOP時のみ同期)──► ANIMATION ──► PRODUCT_LIST
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
                    ▼                         ▼                         ▼
              IMAGE_ZOOM              categoryDrawer              探索操作
              (overlay)               open/closed                 pan/pinch/tap
                    │                         │                         │
                    │                         ▼                         │
                    │                  PRODUCT_DETAIL                   │
                    │                         │                         │
                    └─────────── × → LIST ◄───┘                         │
                                                                        │
                              無操作10分（当該面のみ）───────────────────┘
                                              │
                                              ▼
                                             TOP
```

| 機能 | 接続方針 |
|------|----------|
| **TOP** | LIST 破棄。テクスチャ/renderer dispose。Bubble 非表示 |
| **ANIMATION** | LIST 未マウントまたは非表示。Bubble 無効 |
| **PRODUCT_LIST** | 探索 canvas 1枚 + DOM UI + Bubble 有効候補 |
| **IMAGE_ZOOM** | LIST canvas は残してよい（暗背景）。**Bubble 停止**。interaction off |
| **categoryDrawer** | LIST 上 uiState。**open 中 Bubble 停止**。選択→DETAIL |
| **PRODUCT_DETAIL** | LIST 探索停止または破棄方針を決める。Bubble 無効。×→LIST で再開 |
| **10分無操作** | `idle-timer` の reset 対象に pan/pinch/tap/scroll を接続。Bubble 追従も操作とみなすか要確認（推奨: **みなす**） |
| **4面同期** | LIST 以降独立。各 window が独自 Explore + Bubble。IPC で Bubble 座標を共有しない |
| **content 層** | Main 起動時 index。Renderer は描画中 FS 禁止 |
| **TRUNK ロゴ** | 装飾のみ。hit 対象外。Bubble と無関係 |

### idle（既存実装の要点）

- `app/shared/idleConfig.ts`: 本番 **600秒**、開発デフォルト 20秒（上書き可）
- 対象: `PRODUCT_LIST` / `IMAGE_ZOOM` / `PRODUCT_DETAIL`
- Main `stateCoordinator`: 当該モニターのみ TOP（他台非干渉）
- Renderer `idle-timer.js`: 面単位タイマー

LIST 移植時: Explore の pointer ハンドラから **idle reset API** を必ず呼ぶ。

---

## 6. 操作競合

| 競合 | 推奨方針（DI 準拠 + 本番拡張） |
|------|--------------------------------|
| tap vs Bubble 追従 | Bubble は `pointer-events: none`。短タップ=ZOOM、移動大=pan |
| drag vs camera | 1本指 drag = camera pan。Bubble は追従のみ |
| wheel / pinch vs dolly | PC wheel はデモ用。**本番は pinch=ズーム/dolly 相当**に翻訳。Bubble は中心追従 or 一時固定 |
| IMAGE_ZOOM 中 | Bubble 停止・非表示。LIST 操作ブロック |
| drawer 中 | Bubble 停止。drawer 外スクラムは操作可 |
| 無操作スリープ | 操作で reset。TOP 復帰で描画破棄 |
| タッチ 1本指 | パン主。接触中 Bubble 表示が自然（PC の hover 常時表示は本番必須にしない） |
| タッチ 2本指 | ピンチ優先。Test_TRUNK の「2本指で Bubble 表示」は**本番固定しない** |

**未決（実装前に確定が必要）**

- Bubble は「接触中のみ」か「LIST 中常時」か  
- 1本指: pan と Bubble の同時性（DI は同時）を本番でも許容するか  
- pinch 中の reveal 半径ルール（screen 固定維持を推奨）  

---

## 7. 本番実装ステップ

描画方式確定後に進む。以下は **パス A（Three）** を主表記。パス B は Phase 1–3 を Pixi に読み替え、Phase 5–6 で reveal を Pixi 実装に。

### Phase 0 — ゲート（実装前）

- [ ] PRODUCT_LIST 主描画を **Three / Pixi / その他** で確定  
- [ ] Bubble 半径ルール（screen 固定推奨）確定  
- [ ] タッチ表示トリガー確定  
- [ ] DI 実機（55インチ縦）で sizePx / glint 視認性 OK  

### Phase 1 — PRODUCT_LIST に WebGL canvas 接続

- Renderer に LIST ホストを追加  
- `screenState===PRODUCT_LIST` で mount、離脱で dispose  
- **1 canvas 原則**  
- TRUNK ロゴ・hamburger は DOM  

### Phase 2 — content / images → Plane（or Sprite）

- `getAssetIndex().listImages` + `getContentFileUrl`  
- テクスチャ寿命管理（TOP 復帰で dispose）  
- 枚数は index 準拠（40〜70）  

### Phase 3 — camera 操作 + hit

- drag pan / pinch zoom（dolly 翻訳）  
- tap → Raycaster（または Pixi hit）→ `selectedImageId`  
- idle reset 接続  

### Phase 4 — IMAGE_ZOOM 接続

- tap → `IMAGE_ZOOM` transition（既存 `transitions.ts` 系）  
- overlay DOM（DI/DA 系を本番化）  
- × → 常に PRODUCT_LIST  
- ZOOM 中 interaction / Bubble off  

### Phase 5 — Bubble UI 接続

- DOM BubbleOverlay  
- pointer 追従 + smoothing  
- `bubbleAllowed` ゲート  

### Phase 6 — Bubble color reveal 接続

- パス A: shared uniforms + shader mix  
- パス B: Pixi filter/mask  
- screen px 半径維持  

### Phase 7 — drawer / sleep / 4面

- categoryDrawer open/close と Bubble 停止  
- カテゴリ選択 → PRODUCT_DETAIL（DETAIL 中身は別タスク可）  
- idle 10分・当該面 TOP  
- LIST 以降は面独立（Bubble 非同期）  

### Phase 8 — Review / Debug 整理

- 本番ビルドから Debug HUD / preset トグル除去  
- 開発フラグでのみ FPS / hit debug  
- ロギングは Main `logEvent`  

---

## 8. リスク

| リスク | 深刻度 | 対策の方向 |
|--------|:------:|------------|
| 4面 × WebGL Context Lost | 高 | 1 canvas/面、pixelRatio 上限、長時間試験、復帰ハンドラ |
| Texture memory（70枚×4面） | 高 | 解像度上限、破棄徹底、共有テクスチャ方針の検討 |
| Shader / fill-rate | 中 | 共有 uniforms、不要時 `uRevealActive=0` |
| FPS 低下（特に Three） | 中 | 実機プロファイル。厳しければ Pixi パスへ |
| pointer 競合 | 中 | ゲート徹底、閾値チューニング |
| Electron 本番化 | 中 | GPU プロセス安定、プロトコル URL、パッケージ後 contentRoot |
| タッチ vs PC 操作差 | 中 | キオスク実機でジェスチャ確定 |
| content 差し替え | 中 | index 再生成・再起動手順。描画中スキャン禁止を守る |
| Three 本採用後の方針撤回 | 高 | Phase 0 でゲート。Bubble 仕様はレンダラ非依存に保つ |

---

## 9. 先に確認すべき未決事項

本番実装 Agent / 発注者確認用チェックリスト。

| # | 未決 | 推奨案（DI からの提案） | 影響 |
|---|------|-------------------------|------|
| 1 | **Three.js を PRODUCT_LIST 本採用するか** | 未確定のまま進めない。体験優先なら Three、安定/保守優先なら Pixi | Phase 1 以降すべて |
| 2 | Bubble reveal 半径は screen 固定か | **screen 固定**（DI 方式） | shader/filter 設計 |
| 3 | pinch の本番割当 | 探索ズーム/dolly。Bubble は従属 | ジェスチャ実装 |
| 4 | 4面同期時の LIST 挙動 | **到達後は独立**（確定仕様どおり）。Bubble 非同期 | 実装単純化 |
| 5 | Bubble 常時表示か接触中のみか | **タッチは接触中のみ**推奨。PC レビューは hover 可 | pointer モデル |
| 6 | Debug / Review の本番扱い | **顧客画面に出さない** | UI 範囲 |
| 7 | DETAIL 中の LIST canvas | 破棄 vs 凍結。破棄推奨（メモリ） | dispose 設計 |
| 8 | idle reset に Bubble 移動を含めるか | **含める** | idle-timer 接続 |
| 9 | sizePx 最終値（55"縦） | DI 初期 320。実機で確定 | config |
| 10 | wheel（マウス）を本番で残すか | キオスク非必須。開発のみ可 | 入力層 |

---

## 10. 実装前の合格条件（DI 側）

本番 `app/` の LIST 実装に進む前に、DI（または同等検証）が満たすべきこと。

### Must

- [ ] 1 canvas で 40〜70枚前後が安定表示  
- [ ] pan / zoom（dolly）が破綻しない  
- [ ] 画像 tap → ZOOM → × → LIST が自然  
- [ ] Bubble UI が pointer を奪わない  
- [ ] 円内カラー復帰が一目で分かる  
- [ ] ZOOM / drawer 中に Bubble が止まる  
- [ ] FPS が実機ターゲット（目安 55fps+）を大きく下回らない  

### Should（移植品質）

- [ ] 55インチ縦での size / glint 視認性 OK  
- [ ] タッチ（またはタッチ相当）で追従・tap が競合しない  
- [ ] 長時間稼動で Context Lost / メモリリークがない（または復帰できる）  
- [ ] **主描画方式の確定文書**がある  

### DI 現状とのギャップ

| 条件 | DI 現状 |
|------|---------|
| 体験成立 | **条件付き合格済み** |
| タッチ本仕様 | 未完了 |
| 4面長時間 | 未検証 |
| 主描画確定 | **未完了（最大のゲート）** |

→ **主描画方式が決まれば本番実装着手可。決まらなければ Phase 0 に留める。**

---

## 11. 本番 Agent への申し送り

実装開始時に確認・遵守すること。

1. `docs/screen-flow.json` を状態の正とする  
2. Renderer から `fs` 禁止。`getAssetIndex` / `getContentFileUrl` のみ  
3. LIST は 1 canvas。Pixi+Three 本格併用は避ける  
4. DI を `app/` にディレクトリごとコピーしない  
5. Bubble は DOM、reveal は描画層。仕様は `bubble-color-reveal-spec.md`  
6. 無操作は面単位。Bubble 座標を4面同期しない  
7. TRUNK ロゴにハンドラを付けない  
8. PRODUCT_DETAIL 本実装はこの計画の必須範囲外（drawer ゲートまででも可）  

---

## 付録 A — 推奨モジュール分割（パス A 例）

```text
app/renderer/product-list/
  ExploreHost.tsx          # mount/dispose by screenState
  three/
    sceneController.ts     # DI ExploreController から分割
    bubbleRevealShader.ts
    raycastHit.ts
  bubble/
    bubbleConfig.ts
    BubbleOverlay.tsx
  ui/
    ImageZoomOverlay.tsx
    CategoryDrawer.tsx
```

## 付録 B — 参照した本番コード（読了）

| パス | 内容 |
|------|------|
| `app/README.md` | Phase 2 content。LIST 描画未着手 |
| `app/shared/idleConfig.ts` | 600s / 対象 screenState |
| `app/shared/state.ts` / `transitions.ts` | screenState・drawer・ZOOM |
| `app/electron/state/stateCoordinator.ts` | 4面同期・idle TOP |
| `app/electron/content/*` | assetIndex 生成 |
| `app/renderer/idle-timer.js` | 面単位 idle |
| `docs/architecture.md` | LIST 描画未決の明記 |
| `docs/screen-flow.json` | 遷移・同期・idle |

---

## 付録 C — 今回やらないこと（再掲）

- 本番 `app/` への反映  
- 実装コード変更  
- DI の追加修正  
- DF 本体の変更  
- categoryDrawer 先の PRODUCT_DETAIL 本実装  
