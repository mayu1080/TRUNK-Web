# Production Phase 5.15 report

| 項目 | 内容 |
|------|------|
| 日付 | 2026-08-31 |
| 対象 | Category modal 微調整のみ |

## Card

| | 5.14 | 5.15 |
|--|--|--|
| width | `min(84vw, 760px)` | `calc(100vw - 32px)`（max-width なし） |
| height / max-height | `min(74vh, 1200px)` | `min(66vh, 1040px)` |

## Square logo

| | 5.14 | 5.15 |
|--|--|--|
| size | `clamp(52px, 6.4vh, 72px)` | `clamp(78px, 9.6vh, 108px)`（1.5倍） |
| 背景 | transparent | 白プレート `background: #fff` + `padding: 8px` |

PNG は透明地に黒いマーク。invert は使わない（文字が白飛びするため）。IMAGE_ZOOM の LOGO_TEXT は未変更。
