# Production Phase 5.14 report

| 項目 | 内容 |
|------|------|
| 日付 | 2026-08-31 |
| 対象 | `TRUNK_DEMO=production` |
| 判定 | Category modal を全画面クリームから白いカード型ギャラリーへ |

## 変更しないもの

LIST / IMAGE_ZOOM / CategoryDrawer / globalScene / localOverlay / overlay independence / 120秒 Non-Touch / AD_IDLE / ANIMATION / demo-0820。

## Modal card

| | IMAGE_ZOOM | Category modal (5.14) |
|--|--|--|
| width | `min(84vw, 760px)` | **同じ** `min(84vw, 760px)` |
| height | `min(80vh, 1320px)` | **やや低い** `min(74vh, 1200px)` |
| max-height | `min(80vh, 1320px)` | `min(74vh, 1200px)` |
| 背面 | dark + blur | **同じ** `rgba(12,12,14,0.38)` + `blur(8px)` |

白いカードの外側に LIST が見える。scrim は全画面だがカードは画面全体を覆わない。

## Logo / close / copy

- Square logo: `content/Logo/LOGO_Square.png`（`getContentFileUrl`）。LOGO_TEXT は IMAGE_ZOOM 専用のまま。
- ×: カード右上。線は `font-weight: 300` / 32px。hit 48px。
- title: `categories.json` の `title`（なければ `label`）
- description: `categories.json` の `description`。カードは伸ばさず、description 欄だけ `height: 8.4em; overflow-y: auto`

## Carousel

既存の clone トラックを維持。

- 中央 main + 左右 peek（`SLIDE_PCT = 72`）
- 横スワイプ / フリック
- dots 追従
- 循環: head/tail clone。最後の次 → 最初、最初の前 → 最後
- 1枚: `is-single`。peek / swipe / dots なし。中央固定

## Motion

Drawer と同じ 260 / 230 / 220ms、`cubic-bezier(0.32, 0, 0.58, 0.02)`。カードは `translateY(12px) scale(0.985)` → 静止、close は `translateY(7.2px) scale(0.99)`。

## LIST が description scroll で動かない理由

1. `localOverlay === CATEGORY_MODAL` のときその monitor だけ `interactionLocked`
2. overlay が `inset: 0` で pointer を受ける（背面 canvas に届かない）
3. description は `overscroll-behavior: contain` + `touch-action: pan-y` + `stopPropagation`
