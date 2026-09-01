# Production design decisions log

| 項目 | 内容 |
|------|------|
| 日付 | 2026-08-31 |
| 対象 | `TRUNK_DEMO=production`（`app/renderer/production`） |
| 範囲 | Phase 5.8 以降の LIST / IMAGE_ZOOM / CategoryDrawer / Category modal / フォント |

`demo-0820` / `LIST_demo` は未変更。`globalScene` / `localOverlay` / overlay independence / 120秒 Non-Touch は維持。

---

## 1. LIST 画像の格納先（差し替え前の確認）

設定箇所:

| キー | 値 | ファイル |
|------|-----|----------|
| `manifest.defaultListImageDir` | `images/list` | `content/manifest.json` |
| `LIST_IMAGE_DIR` | `images/list` | `app/shared/contentImageRules.ts` |

実パス（開発時）: リポジトリルート **`content/images/list/`**

読み込み優先順位（`exploreImageCollector`）:

1. `content/images/list/` に画像があれば **それだけ** が LIST ソース（`exploreSource=listImages`）
2. **空なら** `content/images/` を再帰スキャン（food / gift / flower / cm も LIST に出る。`exploreSource=recursive-images`）

**現状ワークスペース:** `images/list/` は **0 枚**。LIST はフォールバックで `images/` 配下を使っている。

差し替えの推奨:

```text
content/images/list/     ← LIST 用（本番の正。ここを埋める）
content/images/food/     ← Category modal 用（categories.json imageDir）
content/images/gift/
content/images/flower/
content/Logo/            ← IMAGE_ZOOM は LOGO_TEXT、modal は LOGO_Square。LIST には出さない
```

注意:

- `list/` を空のまま `food/` 等だけ入れ替えると、カテゴリ画像が LIST にも出続ける
- LIST と modal を分けたいなら **list/ を埋める**
- 推奨形式: `.png` `.jpg` `.jpeg` `.webp`
- 表示枚数目標: **96**（不足分は複製。`TARGET_LIST_CARD_COUNT`）
- 顧客実画像は git に入れない（`.gitignore` の `content/images/**/*`）
- 差し替え後はアプリ再起動。Debug で `exploreSource` / `sourceImageCount` / `displayedImageCount` を確認
- 詳細: `docs/production/production-content-intake.md`、`content/README.md`

Category modal は LIST と独立。`categories.json` の `imageDir`（例 `images/food`）をスキャンする。

---

## 2. 変えていないもの

- CategoryDrawer の見た目・モーション（0820 CSS、260/230ms、bezier `0.32, 0, 0.58, 0.02`）
- IMAGE_ZOOM のカードサイズ（`min(84vw, 760px)` × `min(80vh, 1320px)`）と LOGO_TEXT
- LIST 速度（`sceneDriftSpeed: 72`、`listMotionSpeed: 2.6`）
- 縮小して消える near scale（`nearScaleEnabled: false`）
- overlay 独立性、120秒 Non-Touch、AD_IDLE / ANIMATION

---

## 3. LIST 手前フェード（FO）

線形。wrap は `nearFadeEndDist`。見かけサイズ clamp は fade 開始に追随。

| | 5.11 | その後 |
|--|--|--|
| `nearFadeStartDist` | 1760 | **1520**（カメラ寄り） |
| `nearFadeEndDist` | 960 → 720 試行 | **840**（指定値） |
| `maxApparentScaleDist` | 1760 | **1520** |

---

## 4. IMAGE_ZOOM（参照値）

- 白いカード。背面 dark + blur
- モーションは Drawer と同じ 260 / 230 / 220ms。Y 方向 `12px` / close `7.2px`（scale なし）
- LOGO_TEXT.png（正方形パディングあり）。左端の T と右の × の余白を揃えた
- × は細字（weight 300 / 32px、hit 48px）

---

## 5. Category modal

全画面クリームから、LIST の上に乗る白いカードへ。

### カードサイズ（現行）

| | 値 |
|--|--|
| width | **`100vw`**（1 window 端まで） |
| height / max-height | **`71vh`**（1080px 上限は外した。効いていなかったため） |

経緯: `min(84vw, 760px)` → `calc(100vw - 32px)` → `100vw`。高さ `74vh` → `66vh` → `68vh` → **`71vh`**。

背面 LIST は dark overlay + blur。カード外（上下）に LIST が見える。横は 100vw なので左右には見えない。

### レイアウト

- 上部中央: Square logo（`content/Logo/LOGO_Square.png`）。LOGO_TEXT は使わない
- ロゴサイズ: `clamp(78px, 9.6vh, 108px)`（初期の 1.5 倍）
- ロゴ背景: 白プレート（`background: #fff` + `padding: 8px`）。PNG は透明地＋黒マーク。invert しない
- 右上: 細い ×。tap で `localOverlay = NONE`
- carousel / title / description（dots なし）
- title / description は `categories.json` の `title` / `description`（スライドごとではない）
- description: 高さ固定 `8.4em`、`overflow-y: auto`、`overscroll-behavior: contain`。カードは伸ばさない
- モーション: Drawer と同タイミング。`translateY(12px) scale(0.985)` → close `7.2px` / `0.99`

### Carousel

- 2 枚以上: 循環（clone）。最後の次 → 最初
- 1 枚（Flower など）: peek / swipe なし。dots は枚数に関係なく出さない
- 現行スライド幅 **76%**、左右 peek 各 **12%**
- 非アクティブの `scale(0.92)` は廃止（peek が消えていた原因）。opacity 0.5
- 写真はスライド幅いっぱいに表示（比率維持。縦長は上下が切れることがある）

---

## 6. Maison Neue（.otf）

`content/fonts/MaisonNeue/*.otf` を Main が列挙し、`trunk-content://` + `@font-face format("opentype")` で読む。Renderer は `fs` しない。

適用: CategoryDrawer と Category modal のみ。LIST / IMAGE_ZOOM は未変更。

| ファイル | weight |
|--|--|
| Light / LightItalic | 300 |
| Book / BookItalic | 400 |
| Medium / MediumItalic | 500 |
| Demi / DemiItalic | 600 |
| Bold / BoldItalic | 700 |

スキップ: Mono、Chronicle。欠けても fallback（Helvetica Neue / Arial）。Debug: `fontFamily` / `fontLoaded` / `fontFallback` / `fontFormat: otf`。

---

## 7. Preview / 起動（運用メモ）

- UI 確認: `cd app` → `npm run start:production:preview`（1 window、PRODUCT_LIST 直行、frameless）
- Electron 側（IPC / protocol）を変えたあとは `npm run build` も必要
- キー: `1` AD_IDLE / `2` ANIMATION / `3` LIST。`D` debug
