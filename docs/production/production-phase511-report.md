# Production Phase 5.11 report

| 項目 | 内容 |
|------|------|
| 日付 | 2026-08-30 |
| 対象 | `TRUNK_DEMO=production` |
| 判定 | near fade を手前から線形に。IMAGE_ZOOM close をわずかに延長 |

## LIST near fade

加速度（`sceneDriftSpeed: 72`、`listMotionSpeed: 2.6`）は未変更。

| キー | 5.10 | 5.11 |
|------|------|------|
| nearFadeStartDist | 1180 | **1760** |
| nearFadeEndDist | 520 | **960** |
| maxApparentScaleDist | 1180 | **1760** |
| near fade 曲線 | smoothstep | **線形** |

カメラより十分手前（1760）から alpha が落ち始め、カメラ手前（960）で 0。wrap も 960 なのでカメラ位置まで残らない。smoothstep の終盤ドロップをやめ、距離に比例して薄くなる。

## IMAGE_ZOOM motion

easing / translate / scale は維持。時間だけ少し延長（余韻）。

| | 5.10 | 5.11 |
|--|------|------|
| backdrop | 150ms | **170ms** |
| open | 180ms | **200ms** |
| close | 150ms | **180ms** |

CategoryDrawer は 260 / 230 のまま。
