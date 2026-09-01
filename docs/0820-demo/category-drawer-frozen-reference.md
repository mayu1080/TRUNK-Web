# CategoryDrawer Frozen Reference（8/20 demo）

| 項目 | 内容 |
|------|------|
| 版 | 1.0 |
| 作成日 | 2026-08-18 |
| 対象デモ | 8/20 single-monitor demo |
| 参照実装 | `LIST_demo/demos/DI-three-bubble-reveal` |
| 合格条件 | **新しく良く見えることではなく、DI の CategoryDrawer に近く見えること** |
| 本ドキュメントの範囲 | 見た目・構造・モーションの凍結。実装コード変更は含まない |

機械可読版: [`category-drawer-frozen-reference.json`](./category-drawer-frozen-reference.json)

関連: [`single-monitor-demo-plan.md`](./single-monitor-demo-plan.md)

---

## 1. この文書の使い方

8/20 の CategoryDrawer は **再設計タスクではない**。DI デモの UI を移植・再現する。

実装中に「より良さそう」と判断して色・余白・サイズ・角丸・アニメーション・文言・構造を変えてはならない。

不明点は推測で埋めず、本書の「差分候補 / 不明点」に残す。

---

## 2. 参照した DI デモのファイル

| パス | 役割 |
|------|------|
| `LIST_demo/demos/DI-three-bubble-reveal/src/ui/CategoryDrawer.tsx` | パネル / scrim / カテゴリリスト |
| `LIST_demo/demos/DI-three-bubble-reveal/src/App.tsx` | hamburger、open/close、select 配線 |
| `LIST_demo/demos/DI-three-bubble-reveal/src/styles.css` | hamburger / drawer / z-index / pointer-events |
| `LIST_demo/demos/DI-three-bubble-reveal/src/motionConfig.ts` | `DRAWER_MOTION` / `DRAWER_SCRIM_MOTION` / `MOCK_CATEGORIES` |
| `LIST_demo/demos/DI-three-bubble-reveal/src/ui/DemoToggles.tsx` | `showDrawerScrim` デバッグトグル（本番顧客 UI には出さない） |

---

## 3. DOM 構造（再現対象）

hamburger は `CategoryDrawer.tsx` の外（`App.tsx` の `.ui-chrome-layer`）にある。見た目セットとして **hamburger + scrim + panel をセットで凍結**する。

```text
.app
  ├ .ui-chrome-layer                    (position:absolute; inset:0; z-index:30; pointer-events:none)
  │    └ button.hamburger               (pointer-events:auto via .ui-chrome-layer > *)
  │         ├ 閉じ時: span.hamburger-bar × 3
  │         └ 開き時: span.hamburger-close-mark  「×」
  │
  └ CategoryDrawer (AnimatePresence, open のときのみ)
       ├ motion.button.drawer-scrim     (showScrim === true のとき)
       └ motion.aside.drawer-panel
            ├ header.drawer-header
            │    ├ p.drawer-eyebrow     「Explore」
            │    └ h2.drawer-title      「Category」
            └ nav.drawer-list
                 └ button.drawer-item × N
                      └ span.drawer-item-label
```

**パネル内に独立した close ボタンは無い。** 閉じる UI は右中央 hamburger が × に切り替わったもの、および scrim タップ。

---

## 4. CSS / class / layout（凍結値）

### 4.1 hamburger

| プロパティ | 値 |
|------------|-----|
| class | `.hamburger` |
| position | `absolute` |
| 位置 | `top: 50%; right: 14px; transform: translateY(-50%)` |
| z-index | `32` |
| サイズ | `width: 52px; height: 52px` |
| 形状 | `border-radius: 50%`（円） |
| border | `1px solid rgba(255, 255, 255, 0.14)` |
| background | `rgba(12, 12, 12, 0.55)` |
| backdrop-filter | `blur(10px)` |
| box-shadow | `0 4px 24px rgba(0, 0, 0, 0.35)` |
| 内部 | column / center / `gap: 6px` |
| bar | `.hamburger-bar` `18×2px` / `border-radius: 1px` / `rgba(255,255,255,0.88)` |
| close mark | `.hamburger-close-mark` `font-size: 26px; font-weight: 300; color: rgba(255,255,255,0.92)` |
| touch-action | `manipulation` |

### 4.2 scrim

| プロパティ | 値 |
|------------|-----|
| class | `.drawer-scrim` |
| position | `fixed; inset: 0` |
| z-index | `10` |
| background | `rgba(0, 0, 0, 0.22)` |
| backdrop-filter | `blur(3px)` |
| pointer-events | `auto` |
| 既定表示 | `MOTION_CONFIG.drawer.showScrimDefault = true` |

### 4.3 panel

| プロパティ | 値 |
|------------|-----|
| class | `.drawer-panel` |
| position | `fixed; top: 0; right: 0; height: 100%` |
| 幅 | **`320px`**（`style={{ width: DRAWER_MOTION.widthPx }}`） |
| z-index | `20` |
| background | `rgba(255, 255, 255, 0.65)` |
| color | `#141414` |
| border-left | `1px solid rgba(255, 255, 255, 0.55)` |
| box-shadow | `-8px 0 40px rgba(0, 0, 0, 0.18)` |
| backdrop-filter | `blur(18px) saturate(1.1)` |
| layout | `flex; flex-direction: column; justify-content: center` |
| padding | `0 0 12vh`（コンテンツ塊を中央よりやや上へ） |

### 4.4 header / items

| class | 凍結する見た目 |
|-------|----------------|
| `.drawer-header` | `padding: 28px 72px 20px 24px` / 下ボーダー `1px solid rgba(0,0,0,0.08)` / `text-align: center` |
| `.drawer-eyebrow` | `11px` / `letter-spacing: 0.14em` / `uppercase` / `rgba(0,0,0,0.42)` / 文言 **Explore** |
| `.drawer-title` | `22px` / `font-weight: 500` / 文言 **Category** / `#111` |
| `.drawer-list` | column / `padding: 12px 0 24px` / overflow auto |
| `.drawer-item` | `min-height: 60px` / `padding: 0 72px 0 28px` / `font-size: 17px` / `letter-spacing: 0.04em` / 中央揃え / 透明背景 / `color: rgba(0,0,0,0.72)` |
| `.drawer-item.selected` | 背景 `rgba(255,255,255,0.45)` / 文字 `#000` |
| `.drawer-item-label` | 左ボーダー `2px solid transparent` + `padding-left: 12px` |
| selected label | `border-left-color: rgba(0, 0, 0, 0.45)` |

hover / `:active` は selected と同じスタイル（DI 準拠）。タッチでは hover が残りうる（WinTouch 既知リスク。見た目値は変えない）。

---

## 5. Motion / animation（凍結値）

framer-motion。easing は `EASE_DRAWER_IN_QUAD = [0.32, 0, 0.58, 0.02]`。

### panel（`DRAWER_MOTION`）

| 項目 | 値 |
|------|-----|
| open | `260ms` |
| close | `230ms` |
| initial | `{ x: 12, opacity: 0 }` |
| animate | `{ x: 0, opacity: 1 }` |
| exit | `{ x: 12 * 0.6, opacity: 0 }` → **x: 7.2** |

### scrim（`DRAWER_SCRIM_MOTION`）

| 項目 | 値 |
|------|-----|
| duration | `220ms` |
| initial / animate / exit | opacity `0` → `1` → `0` |
| easing | 同上 quad |

AnimatePresence で mount/unmount。パネル幅のスライドイン（画面外から大きく入る）ではなく、**短い x=12px + fade**。

---

## 6. overlay / scrim / z-index / pointer-events

| 層 | z-index | pointer-events |
|----|---------|-----------------|
| Three canvas `.three-layer` | 0 | 通常ヒット |
| `.drawer-scrim` | 10 | auto（タップで close） |
| Bubble overlay | 15 | **none** |
| `.drawer-panel` / `.zoom-backdrop` | 20 | auto |
| `.ui-chrome-layer` | 30 | none（子は auto） |
| `.hamburger` | 32 | auto |

drawer open 中:

- Explore の interaction は **off**（DI: `pointerBlocked = isImageZoomOpen \|\| isCategoryDrawerOpen`）
- Bubble は **停止・非表示**

IMAGE_ZOOM と drawer を同時表示しない（8/20 は screenState で排他）。

---

## 7. カテゴリ項目（文言凍結）

DI `MOCK_CATEGORIES`:

| id | label（画面表示。変更禁止） |
|----|---------------------------|
| `food` | Food |
| `gift` | Gift |
| `flower` | Flower |

本番 `categories.json` の label は `FOOD` / `GIFT` であり、**drawer 表示文言には使わない**。8/20 の見た目は DI の title case を正とする。

---

## 8. Category select 後の挙動

### DI 現状（見た目参照。遷移はデモ不足）

- `onSelectCategory(id)` → `selectedCategoryId` をセットするだけ
- drawer は開いたまま
- PRODUCT_DETAIL へは行かない
- 選択 item に `.selected` が付く

### 8/20 で必要な遷移（配線差。見た目は凍結）

```text
Category select → PRODUCT_DETAIL placeholder
PRODUCT_DETAIL close → PRODUCT_LIST（drawer closed）
```

これは **許容される差分（挙動・状態機械のみ）**。select 時にパネルの色・余白・モーションを変えない。

推奨配線:

1. item tap
2. `CATEGORY_SELECT`（または同等）で `screenState = PRODUCT_DETAIL`
3. drawer は閉じた状態（本番 `transitions.ts` は select 時 `uiState: closed`）
4. DETAIL 中は hamburger / drawer / Bubble を出さない

---

## 9. 再現対象 / 変更禁止 / 許容・非許容差分

### 再現対象

- hamburger 位置・円形・3本線 / × 切替
- 右から 320px frosted panel
- scrim の色・blur・fade
- Explore / Category 文言と typography
- Food / Gift / Flower の3項目と item 高さ・padding
- open/close の duration / easing / x / opacity
- drawer 中の LIST 操作停止と Bubble 停止

### 変更禁止

- 独自判断の見た目改善
- 色、余白、サイズ、角丸、アニメーション、文言、大きな構造変更
- 「より良さそう」という理由の再デザイン
- 本番 `FOOD` ラベルへの置換
- パネル内への新しい close ボタン追加（DI に無い）
- hamburger を左上や右上へ移動

### 許容される差分

| 差分 | 理由 |
|------|------|
| select 後に PRODUCT_DETAIL へ遷移し drawer を閉じる | 8/20 必須遷移。DI は未配線 |
| IMAGE_ZOOM / DETAIL 中は hamburger を出さない | 本番 screenState 排他。DI は常時 LIST |
| Review では scrim トグルを出さない | DI も review では DemoToggles 非表示 |
| カテゴリ配列の **データ源**（定数でも JSON でも、**表示は DI 文言**） | 見た目が同じなら可 |
| 55インチで touch ターゲットが足りない場合の **報告** | 勝手にサイズ変更せず、差分候補として上げる |

### 許容されない差分

- 幅を 320 以外にする
- 右スライドの大きな translate に変える
- 背景を不透明白や別カラーにする
- 項目をアイコン付きカードにする
- 文言を日本語化 / 大文字化
- flower を見た目から消す
- hamburger を ☰ アイコンフォントに置き換える

---

## 10. 差分候補 / 不明点（推測で埋めない）

1. **WinTouch で `:hover` が残る** — DI は hover=selected 同スタイル。実機で残ったら、見た目値は変えず報告する。
2. **55インチで 52px hamburger / 60px item が小さい** — 変更せず、当日 Debug と写真で確認。必要なら発注者確認後に scale を別タスクにする。
3. **本番 categories に flower が無い** — 見た目は3項目維持。Flower 選択時の DETAIL はプレースホルダーでよい。
4. **scrim z-index 10 vs hamburger 32** — DI どおり。scrim は hamburger の下なので、開き中も × は押せる。
5. **zoom と drawer が同じ z-index 20** — 同時表示しない前提。8/20 では状態機械で排他する。
6. **DI は drawer を閉じても selectedCategoryId が残る** — 8/20 は DETAIL から LIST に戻ったら選択解除（本番 `PRODUCT_DETAIL_CLOSE` に合わせる）でよい。見た目差は DETAIL 非表示時のみ。

---

## 11. 実装時チェックリスト

- [ ] DI を画面横に並べ、hamburger 位置・panel 幅・文言が一致して見える
- [ ] open/close が「大きくスライド」ではなく短い x + fade に見える
- [ ] scrim tap と hamburger × の両方で閉じられる
- [ ] drawer 中に LIST pan/tap と Bubble が動かない
- [ ] Review Mode で Debug / トグルが隠れ、drawer 自体は見える
- [ ] 色・font-size・padding を「調整」していない
