# Production State Flow

| 項目 | 内容 |
|------|------|
| 版 | 0.1 |
| 日付 | 2026-08-29 |
| フェーズ | Production Phase 0（設計のみ） |
| 機械可読版 | [`production-state-flow.json`](./production-state-flow.json) |

関連: [`production-app-architecture.md`](./production-app-architecture.md) / [`production-touch-gestures.md`](./production-touch-gestures.md)

---

## 0. 正と差分

本番の状態機械の正は本書。8/20 `demo-0820` の遷移（LIST ↔ ZOOM、Drawer → DETAIL placeholder、×で LIST）を **ローカル overlay として継承**する。グローバルは 4 面同期用に組み直す。

| 旧 (`docs/screen-flow.json` / 0820) | 本番 |
|-------------------------------------|------|
| `screenState: TOP` | `globalScene: AD_IDLE` |
| `IMAGE_ZOOM` / `PRODUCT_DETAIL` が screenState | `localOverlay`（`globalScene` は `PRODUCT_LIST` のまま） |
| 10分・当該面のみ TOP | **120秒・4面全体** → 全面 `AD_IDLE` |
| 全台 TOP のときだけ入場（1台 TOP では他を巻込まない） | 全体 idle のため探索中は全台同じ `globalScene`。部分 TOP は発生しない |
| ANIMATION 中の skip は未規定 | **touch 無視。skip / 早送りしない** |

---

## 1. Global Scene（2-1）

4 モニターで常に同一。Main の `StateCoordinator` が唯一の書き手。

| ID | 意味 | 映像 | タッチ |
|----|------|------|--------|
| `AD_IDLE` | 4画面同期の広告待機。**1つの広告コンテンツ**を4面に出す | `ads.json` + `ads/monitor-N.mp4`（共有 clock）。欠落は placeholder | どの面でも 1本指以上 → 全面 ANIMATION |
| `ANIMATION` | 入場演出 | 各面 `animation/monitor-N.mp4` | **無視**（ログ可） |
| `PRODUCT_LIST` | 探索 | 各面 Three LIST（クローン世界） | 面ごとに独立。overlay は local |

```text
AD_IDLE
  ↓ any monitor touch（1 finger or more）
ANIMATION
  ↓ animation finished（skip なし）
PRODUCT_LIST
```

`PRODUCT_LIST` 中も `globalScene` は `PRODUCT_LIST` のままである。ZOOM を開いても他面のグローバルは変わらない。

---

## 2. Local Overlay（2-2）

モニターごとに独立。同時に異なる overlay を開いてよい。同一モニターでは **同時に1つ**（排他）。

| ID | 8/20 対応 | UI |
|----|-----------|-----|
| `NONE` | LIST のみ | hamburger 可視。LIST 操作可 |
| `IMAGE_ZOOM` | `screenState=IMAGE_ZOOM` | 白系カード。Box logo。背面 LIST lock |
| `CATEGORY_DRAWER` | `uiState.categoryDrawer=open` | 右ドロワー。hamburger は × |
| `CATEGORY_MODAL` | `PRODUCT_DETAIL` placeholder | ギャラリーモーダル。Drawer は閉じる |

`interactionLocked = localOverlay !== 'NONE'`。

遷移時は選択状態をクリアする。

- ZOOM close → `selectedImageId = null`
- modal close → `selectedCategoryId = null`
- Drawer close（select なし）→ 選択カテゴリは持たない

---

## 3. 遷移詳細（2-3）

### 3.1 グローバル

```text
AD_IDLE
  ↓ any monitor: pointerdown / touchstart（1本以上）
ANIMATION          // 4面同時。VideoSync start
  ↓ animation finished
PRODUCT_LIST       // 4面同時。各面 Explore 初期化（viewport offset 適用）
```

ANIMATION 中の追加 touch: 状態を変えない。必要なら `[touch-ignored]` ログ。

### 3.2 モニター N の IMAGE_ZOOM

```text
PRODUCT_LIST on monitor N  (localOverlay=NONE)
  ↓ image tap（hit 成立）
monitor N: IMAGE_ZOOM      // 他面は NONE のまま操作可
  ↓ close（画像外 tap / 透明× / 右上×）
monitor N: NONE
```

close は常に当該面の LIST（`NONE`）へ。直前の Drawer には戻らない。

### 3.3 モニター N の Category

```text
PRODUCT_LIST on monitor N  (NONE)
  ↓ hamburger
monitor N: CATEGORY_DRAWER
  ↓ hamburger × / scrim tap
monitor N: NONE

PRODUCT_LIST on monitor N  (CATEGORY_DRAWER)
  ↓ category select
monitor N: CATEGORY_MODAL   // Drawer は閉じる
  ↓ close（×）
monitor N: NONE
```

select で Drawer と modal を同時表示しない。

### 3.4 全体 Non-Touch 120秒

対象: `globalScene === PRODUCT_LIST`（overlay 中も含む）。`AD_IDLE` と `ANIMATION` ではカウントしない。

```text
Any interactive state（LIST / ZOOM / Drawer / modal、どの面でも）
  ↓ 4画面全体で、最後の有効操作から 120 秒、どのモニターにも有効 touch がない
AD_IDLE
```

復帰時 **全モニター**:

- `localOverlay = NONE`
- `selectedImageId` / `selectedCategoryId` クリア
- Bubble / gesture / ポインタ追跡クリア
- LIST カメラ・dolly 速度を破棄し、再入場時に初期化する
- 広告動画を VideoSync で再 start

1面だけ操作が続いていれば、他面が無操作でも全体は戻さない。

---

## 4. Overlay independence（2-4）

必ず守る:

- monitor 1 が `IMAGE_ZOOM` 中でも、monitor 2〜4 は `PRODUCT_LIST` を操作できる
- monitor 2 が `CATEGORY_DRAWER` 中でも、monitor 1 / 3 / 4 は `PRODUCT_LIST` を操作できる
- monitor 3 が `CATEGORY_MODAL` 中でも、他面は LIST も独自 overlay も可能
- overlay 中の操作ロックはその overlay を出している monitor に限定する
- 他モニターの LIST / Bubble / tap / pinch / 2本指上下は止めない

実装含意: ZOOM を `globalScene` に上げない。Main は overlay 変更を **当該 window にだけ**送る。他 window の `interactionEnabled` を落とさない。

---

## 5. 有効操作と 120秒（D, E）

時計は Main の `TouchActivityManager` に1本。`lastValidTouchAt` は全 monitor で共有。

### 5.1 reset する

- tap
- drag 開始
- pinch 開始
- 2本指上下開始
- drawer open / close
- category select
- zoom open / close
- modal close

実装の主な契機: `pointerdown` / `touchstart` / gesture start（pinch 2点目、2本指縦の開始）。状態アクション（open/close/select）も Main 側で reset する。

### 5.2 reset しない

- 単なる Bubble 追従
- hover 的な `pointermove` だけ（接触なし）

タッチパネルに hover は基本ない。誤って mouse move が来ても、down なしでは reset しない。

### 5.3 ANIMATION / AD_IDLE

- `AD_IDLE` の touch は idle タイマーではなく **入場トリガ**
- `ANIMATION` の touch はタイマーもシーンも動かさない

---

## 6. アクション（実装時の契約案）

グローバル（どの面からでも、結果は全面）:

| action | 条件 | 結果 |
|--------|------|------|
| `AD_IDLE_TOUCH` | `globalScene=AD_IDLE` | 全面 `ANIMATION` |
| `ANIMATION_COMPLETE` | `ANIMATION`。VideoSync が終了判定 | 全面 `PRODUCT_LIST`、各 overlay `NONE` |
| `GLOBAL_IDLE_TIMEOUT` | `PRODUCT_LIST` かつ 120秒無有効操作 | 全面 `AD_IDLE`、全 local クリア |

ローカル（monitorId 付き）:

| action | 条件 | 結果（当該面のみ） |
|--------|------|-------------------|
| `LIST_IMAGE_TAP` | LIST かつ overlay `NONE` | `IMAGE_ZOOM` |
| `IMAGE_ZOOM_CLOSE` | `IMAGE_ZOOM` | `NONE` |
| `CATEGORY_DRAWER_OPEN` | `NONE` | `CATEGORY_DRAWER` |
| `CATEGORY_DRAWER_CLOSE` | `CATEGORY_DRAWER` | `NONE` |
| `CATEGORY_SELECT` | `CATEGORY_DRAWER` | `CATEGORY_MODAL` |
| `CATEGORY_MODAL_CLOSE` | `CATEGORY_MODAL` | `NONE` |
| `TOUCH_ACTIVITY` | `PRODUCT_LIST` | シーンは変えず `lastValidTouchAt` 更新 |

0820 の `TOP_ENTRY_TAP` / `PRODUCT_DETAIL_CLOSE` / `IDLE_TIMEOUT`（per-monitor）は、本番では上表に置き換える。

ANIMATION 中の `AD_IDLE_TOUCH` 相当は reject。LIST 中の `AD_IDLE_TOUCH` も reject（入場は idle からのみ）。

---

## 7. 排他・ゲート

同一 monitor:

- overlay 中は LIST tap / pan / dolly 無効
- ZOOM 中は hamburger を出さない（0820 と同じ）
- Drawer 中は LIST 操作オフ、Bubble 停止（0820 / DI と同じ）
- modal 中も同様
- ZOOM と Drawer を同時表示しない

他 monitor: ゲートを共有しない。

---

## 8. 動画終了と入場

第一候補:

1. Main が ANIMATION 開始時刻 `T0` と duration `D`（`animation.json` または4本の最大 duration）を持つ
2. `T0 + D` で `ANIMATION_COMPLETE`（全面）
3. 個別 `ended` はログ。1面だけ先に終わっても他面を待たず duration で切る、または全面 ended 待ち（**未決。実装前に1つに固定**）
4. 安全上限（例: `D + 2s` または 12s cap のような 0820 の ready cap に相当）で必ず LIST へ進む

AD_IDLE はループし、touch で即 ANIMATION。広告の再生位置は破棄してよい。

---

## 9. 未決（状態）

1. ANIMATION 終了の正（共有 duration / 全面 ended / max(ended)）
2. 開発時の ANIMATION 短縮フラグ
3. 120秒の開発上書き（現行 `TRUNK_IDLE_TIMEOUT_SECONDS` を流用するか）
4. modal close と Drawer を「select 前に戻す」導線は作らない（確定: 常に `NONE`）
5. 同一面で ZOOM 中に他面の状態を HUD に出すか（開発のみ）
