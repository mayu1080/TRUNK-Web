# Production Phase 5.5 report

| 項目 | 内容 |
|------|------|
| 日付 | 2026-08-30 |
| 対象 | `TRUNK_DEMO=production` |
| 判定 | Preview mode / LIST preload / noise mp4 / 低リスク UX を実装。独立性と 120秒は維持。Phase 6 には未着手 |

## Preview / FullHD 確認方法

```powershell
cd app
# 日常の UI 確認（1 window・縦 1080×1920・拡縮可能）。初期シーンは PRODUCT_LIST
npm run start:production:preview

# 上と同じ
npm run start:production:preview:single

# 4window 状態確認（globalScene / overlay independence / 120秒 idle）
npm run start:production:preview:multi

# 本番相当 4window
npm run start:production
```

既定 preview: `TRUNK_PRODUCTION_PREVIEW_MODE=portrait`（論理サイズ 1080×1920）、`TRUNK_PRODUCTION_PREVIEW_WINDOWS=single`。packaged では無効。unpackaged の preview コマンドはディスプレイ数に関係なく preview 配置を使う（本番 `start:production` の layout 照合は変えない）。

| 変数 | 意味 |
|------|------|
| `TRUNK_PRODUCTION_PREVIEW_MODE` | `portrait`（1080×1920）/ `fullhd`（1920×1080）/ `off` |
| `TRUNK_PRODUCTION_PREVIEW_WINDOWS` | `single`（1 window）/ `multi`（4 window タイル） |
| `TRUNK_PRODUCTION_PREVIEW_SCALE` | 0.15〜1。省略時は work area に収まる最大 scale。multi の横長 PC では 4×1 グリッドを自動選択 |

single-window は work area に 1 枚をフィットして中央配置。Debug は初期非表示。`Show debug` または `D` で切替。

4window preview（`SCALE=0.5`）の回帰: **540×960**、grid **2×2**。`isDevFallback: false` / `isPreviewMode: true`。

通常の `npm run start:production` は preview env なし。1 display では従来の小さい 2×2 fallback。4 display 照合時は本番配置。

## loading content images 対策

ANIMATION 開始で ExploreHost を mount（画面上は video / placeholder の裏）。70 カード + texture をこの間に読む。PRODUCT_LIST 入場時は同じインスタンスを継続し、`loading content images…` バナーは出さない。間に合わない場合は黒クリアカラーの Three canvas のみ。

破棄方針: **AD_IDLE で unmount / WebGL 破棄**。AD_IDLE 中は常時ロードしない。

今回の boot: ANIMATION 中に 4 面とも `production three list ready` → `textureLoadedCount: 70` → その後 LIST 入場。

Debug: `listPreloadStatus` (`idle` / `loading` / `ready` / `failed`)、`preloadStartedAt`、`preloadDurationMs`、`textureLoaded` / `failed`。

## noise mp4

`content/noise/` から mp4 を解決。今回は **`NOISE_02.mp4`** を検出。LIST / IMAGE_ZOOM / Category modal に薄い video overlay（opacity 0.08、`pointer-events: none`）。欠落時は warning + 既存 DOM grain。アプリは落とさない。`listConfig.noiseEnabled` / opacity で調整。

## 低リスク UX

- CategoryDrawer の ×（hamburger close 化）を削除。hamburger は `localOverlay=NONE` のときだけ。**scrim tap で閉じる**。カテゴリ tap は modal。
- Category modal は 2 枚以上で **loop carousel**（端の次が先頭）。1 枚は `is-single` のまま。
- Box logo 背景を **白地**。LIST には出さない。

## 確認のみ（大きなデザイン変更なし）

### IMAGE_ZOOM

フルブリードのクリーム overlay（`inset: 0`）。画像は `max-width: min(56vw, 480px)`。**見た目の判断は `npm run start:production:preview`（1 window）で行う。** 白ブチ / backdrop tap / 右上× / 画像下× / Box logo は動作する。

### Category modal

ZOOM 同様に画面いっぱいのクリーム面で、背面 LIST はほぼ見えない。横 peek は 72% スライドである。**「LIST 上の小さなモーダル」にはなっていない。** 提案: 確認後に余白付きカード（例: 上下 10%、背面を少し見せる scrim）へ。今回は未変更。

### LIST fade / near cut

値は `nearFadeStartDist: 320` / `nearFadeEndDist: 40` / `appearFadeMs: 700`。preview 縮小では near cut が弱く見えうる。本番サイズで「手前で巨大化して通り過ぎる」なら nearFadeStart を 400〜480 へ上げる案。今回は未変更。

## build / check

`npm run build`、renderer build、`check:production-overlay` / `phase2` / `content` / `phase4` / `phase5` / **`phase55`** すべて ok。idle dump は 120秒。1 面 overlay 中も他面 `NONE`。`demo-0820` 未変更。

## Phase 6 へ進めるか

**schema / 運用の Phase 6 はブロッカーなし（見た目と独立）。** ただし IMAGE_ZOOM / Category modal の最終見た目は preview 確認待ち。UX 調整を先にするなら Phase 6 は後ろへ。指示があればどちらからでも入れます。
