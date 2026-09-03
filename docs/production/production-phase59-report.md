# Production Phase 5.9 report

| 項目 | 内容 |
|------|------|
| 日付 | 2026-08-30 |
| 対象 | `TRUNK_DEMO=production` |
| 判定 | AD_IDLE 仕様明記、near fade 強化、LIST speed 2.6、LOGO_TEXT 拡大、IMAGE_ZOOM CSS motion |

## 初回起動時の AD_IDLE / ANIMATION

**意図的な仕様です。** 広告タブが消えたわけではありません。

| 起動 | 初期 `globalScene` |
|------|---------------------|
| `npm run start:production` | **AD_IDLE**。touch → ANIMATION → PRODUCT_LIST。このフローは消えない。 |
| `npm run start:production:preview`（single） | **PRODUCT_LIST 直行**。LIST / overlay の UI 確認用に AD / ANIMATION をスキップ。 |
| `npm run start:production:preview:multi` | **AD_IDLE**（本番と同じ開始）。 |

preview で AD / ANIMATION を見る方法:

1. `npm run start:production:preview:multi`
2. single preview で `1` → AD_IDLE、`2` → ANIMATION、`3` → PRODUCT_LIST（review でもキーは効く）。AD_IDLE 中に tap すると ANIMATION。

Debug に `startupScene` を表示。README にも記載。

## near fade / cut

| キー | 5.8 | 5.9 |
|------|-----|-----|
| nearFadeStartDist | 720 | **1180** |
| nearFadeEndDist | 260 | **520** |
| nearScaleStartDist | 880 | **1360** |
| nearScaleMin | 0.28 | **0.20** |

カメラ手前で消えることを優先。Debug に現在値を表示。

## LIST speed

**2.4 → 2.6**（+0.2）

## LOGO_TEXT

`height: clamp(64px, 8vh, 120px)`  
`max-width: min(72%, 440px)`  
カード上パディングを広げ、ロゴが画像に重ならないようにした。装飾のみ。

## IMAGE_ZOOM motion

framer-motion なし。CategoryDrawer と同系統の CSS + double rAF。

- easing `cubic-bezier(0.32, 0, 0.58, 0.02)`
- backdrop / scrim **220ms** opacity
- open **280ms**: card `translateY(12px) scale(0.985)` / opacity 0 → 0 / 1
- close **230ms**: `translateY(8px) scale(0.99)` / opacity 0
- `CLOSE_OVERLAY` は即座。paint だけ closeMs 残す。他 monitor には影響しない。

## 残る修正点

- Category modal は全画面クリームのまま（今回対象外）
- AD_IDLE / ANIMATION 動画の本調整は未着手
