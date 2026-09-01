# Production Phase 5 report

| 項目 | 内容 |
|------|------|
| 日付 | 2026-08-30 |
| 対象 | `TRUNK_DEMO=production`（`app/renderer/production`） |
| 判定 | UX FB を localOverlay 上に実装。独立性 / 120秒 / content validation は未変更 |

## 壊していないもの

- `globalScene`（AD_IDLE → ANIMATION → PRODUCT_LIST）
- per-monitor `localOverlay`（NONE / IMAGE_ZOOM / CATEGORY_DRAWER / CATEGORY_MODAL）
- `interactionLocked = localOverlay !== 'NONE'`（他面は操作継続）
- 全体 120秒 Non-Touch（`PRODUCTION_SHELL_IDLE_TIMEOUT_SECONDS`）
- `npm run check:production-content` の検証ルールと LIST 70-card expand

## FB 実装

| FB | 実装 |
|----|------|
| IMAGE_ZOOM | クリーム背景、小さめ画像 + 12px 白ブチ、title/description、画像外 tap で close、右上 ×、画像下透明 ×（opacity 0.22）、上部中央 Box logo（`content/Logo`、タップで閉じない） |
| LIST | 手前 `nearFadeStartDist 320` → `nearFadeEndDist 40` で fade 後 cut。wrap 時 `appearT=0` → 700ms fade-in。初期配置は `appearT=1` |
| Noise | 0820 には無い。再検討の結論: DOM grain を **default on / opacity 0.08 / soft-light**。`listConfig.noiseEnabled` で切れる。新規アセットなし |
| Touch | 2本指は pinch と縦を **フレーム内で1入力**。`|Δdistance|` が大きいときだけ pinch。それ以外は重心 Y。セッション 10px で縦 arm、上方向 = 潜る（Shift 上と同じ）。`lastDollyInput` で確認可 |
| Logo | LIST には出さない。ZOOM / Category modal のみ |
| Category modal | 72% スライド + 左右 peek、ドラッグ + フリック。`slides.length <= 1`（flower）は `is-single`: 中央寄せ、dots/swipe なし |

## Flower 1枚

`content/images/flower` は 1 枚。Phase 5 では `is-single` レイアウトで中央固定。dots を出さず、swipe を無効化するのでトラックが空に飛ばない。

## 確認コマンド

```powershell
cd app
npm run build
npm --prefix renderer/production run build
npm run check:production-overlay
npm run check:production-phase2
npm run check:production-content
npm run check:production-phase4
npm run check:production-phase5
```

次は Phase 6（content schema / 差し替え手順）。Phase 5 では着手しない。
