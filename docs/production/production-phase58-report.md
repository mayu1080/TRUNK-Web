# Production Phase 5.8 report

| 項目 | 内容 |
|------|------|
| 日付 | 2026-08-30 |
| 対象 | `TRUNK_DEMO=production` |
| 判定 | LIST fade/density/clean/bubble/noise、IMAGE_ZOOM カード、Drawer 0820 motion、preview frameless |

## 本番 title bar / debug bar

確認結果: Phase 5.7 時点で `start:production` は `frame: false`。preview だけ `frame: true` だったため、single preview に `TRUNK production preview…` の title bar が出ていた。本番相当では title bar は出ない。

5.8 で preview も **既定 frameless**。title bar が必要なら `TRUNK_PRODUCTION_PREVIEW_FRAME=1`。

in-app debug / BOUNDS MISMATCH / Show debug は review 既定で非表示。本番・preview とも同じ。`D` で debug。

## near fade / cut

| キー | 5.7 | 5.8 |
|------|-----|-----|
| nearFadeStartDist | 460 | **720** |
| nearFadeEndDist | 90 | **260** |
| nearScaleStartDist | 520 | **880** |
| nearScaleMin | 0.42 | **0.28** |

カメラ手前で明確に消えることを優先。

## visual / Bubble / noise

- visual preset 初期値: **clean**
- bubble size **160** / reveal radius **80** / motion **off**
- noise opacity **0.20**（mp4 維持）

## 画像密度

方針: 枚数を増やし、world も少し詰める。

- `densityPreset`: **dense-96**
- `displayedImageCount` / `targetCardCount`: **96**（旧 70。同じ画像の複製可）
- sceneSpread: X 3720（旧 4400）/ Y 2360（旧 2800）/ Z 6000（旧 6800）
- FPS / textureLoadedCount は Debug に表示

テクスチャは共有のまま mesh だけ増やす。4 面で重くなったら 96 を下げる。

## IMAGE_ZOOM

- カードは固定領域 `min(84vw, 760px)` × `min(80vh, 1320px)`。画像に合わせて伸縮しない
- image area は flex で残り、copy は `min-height: 8.2em` を確保
- LOGO_TEXT: `height: clamp(44px, 6.2vh, 88px)`（旧 18–36px）
- ×: `.image-zoom-overlay__close-glyph`、`font-weight: 300` / `font-size: 32px`、hit 48px

## CategoryDrawer motion

参照: `app/renderer/demo-0820/src/drawerMotion.ts` と Frozen / DI（同じ定数）。

production に framer-motion は入れず、CSS で同等値:

- easing `cubic-bezier(0.32, 0, 0.58, 0.02)`
- open 260ms、close 230ms
- panel initial `translateX(12px)` / opacity 0 → 0 / 1。close は 230ms
- scrim opacity 220ms
- フォント・文字組は 5.7 のまま

## 残る Category modal

全画面クリームのまま。白カード化は後続。
