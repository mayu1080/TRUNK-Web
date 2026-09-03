# Production Phase 5.7 report

| 項目 | 内容 |
|------|------|
| 日付 | 2026-08-30 |
| 対象 | `TRUNK_DEMO=production` |
| 判定 | UX 修正パス1（chrome / preload / near fade / preview 初期値 / noise / IMAGE_ZOOM カード / Drawer 0820） |

## Debug / Review / Production 表示

| 面 | chrome（topbar / badge / Show debug） | Window |
|----|----------------------------------------|--------|
| preview + review（既定） | 非表示 | frame あり。single は拡縮可 |
| preview + debug（`D` / `G`） | 表示。`P` または Show debug でパネル | 同上 |
| `start:production` | review 既定。frameless（title bar なし） | layout bounds。fullscreen/kiosk は未実装 |
| packaged 本番 | 同上。将来 kiosk は exit 経路を決めてから | frameless + monitor-layout bounds を正とする |

本番で Windows のアプリ名 titile bar を出し続けない。4 物理ディスプレイでは各 window を layout の bounds に置く方が `fullscreen: true` より安全（primary に寄らない）。

Review 中は `D` で debug に戻せる（現場キーボード想定）。

## loading content images

文言は production renderer から排除。ANIMATION 中に ExploreHost mount。LIST 入場時に texture 未完了なら黒 canvas のみ（`is-preload`）。scene copy も出さない。

Debug: `listPreloadStatus` / `preloadStartedAt` / `preloadDurationMs` / `textureLoadedCount` / `textureFailedCount` / `preloadReadyBeforeListEnter`.

## near fade / cut

| キー | 旧 | 新 |
|------|----|----|
| nearFadeStartDist | 320 | 460 |
| nearFadeEndDist | 40 | 90 |
| nearScaleStartDist | — | 520 |
| nearScaleMin | — | 0.42 |

手前で alpha を落とし、巨大化前に scale も絞る。

## production preview 初期値

visual `soft-tint` / bubble motion `off` / pixel ratio `2` / bubble+reveal `160` / list speed `2.4` / dolly cruise on / feel `punchy`（speed 2.6 / smoothing 0.45 / pinch 2.4）。

## noise

`content/noise/NOISE_02.mp4`、opacity **0.14**（旧 0.08）。

## IMAGE_ZOOM

全画面クリームをやめ、LIST 上の白いカード。backdrop は暗い blur。カード左上 `LOGO_TEXT.png`（`logoAsset` が `LOGO_TEXT.*` を優先）、右上 ×、画像はカード内 contain、仮 title / category label / description。backdrop tap で close。localOverlay のみ。

## 画像とテキスト

推奨は `content/image-details.json`（案A）。詳細は [`production-image-copy.md`](./production-image-copy.md)。

## CategoryDrawer

0820 の Explore / Category / Food·Gift·Flower のサイズ・letter-spacing・padding（header `28px 72px 20px 24px`、item `0 72px 0 28px`、title 22px / 500、item 17px / 0.04em）。label は Title Case。× なし。

## Drawer 外 tap のグレー

scrim / hamburger を `appearance: none`、`-webkit-tap-highlight-color: transparent`、hover/active/focus でも背景を変えない。

## 残る Category modal

まだ全画面クリーム。小さい白いカード化、peek 余白、テキスト本実装は後続。
