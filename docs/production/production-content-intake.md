# Production Content Image Intake

| 項目 | 内容 |
|------|------|
| 版 | 0.1 |
| 日付 | 2026-08-29 |
| フェーズ | Production Phase 3.5（投入ルール + validation。UI 本実装ではない） |
| 機械可読版 | [`production-content-intake.json`](./production-content-intake.json) |

関連: [`production-content-schema.md`](./production-content-schema.md) / `content/README.md`

---

## 0. 目的

本番画像を `content/` に差し替えるとき、LIST がどのファイルを使うか、何が警告かを固定する。アプリは落とさない。warning は log / Debug / `npm run check:production-content` で見る。

---

## 1. 推奨フォルダ

```text
content/
  images/
    list/          # PRODUCT_LIST の正（本番はここを埋める）
    food/          # Category modal 用。LIST フォールバックにも出る
    gift/
    flower/
  categories.json
  Logo/            # IMAGE_ZOOM / Category modal のみ。LIST には出さない
```

`content/images/` 配下の recursive scan は **空の list/ のときだけ** LIST ソースになる（現行どおり維持）。

---

## 2. LIST 取得優先順位

1. `assetIndex.listImages`（起動時に `content/images/list/` をスキャンした結果）
2. `content/images/list/` が空なら、このフォルダは使わず次へ
3. `content/images/` 配下の recursive scan（food / gift / flower / cm など）

本番差し替え後は **1 だけが効く**状態（`images/list/` に LIST 用を置く）を目指す。3 は開発サンプルと移行用。

Category modal（Phase 4）は `categories.json` の `imageDir` / `imageIds` を正とする。LIST と同じファイルを参照してよいが、**LIST 専用フォルダとカテゴリフォルダを分ける**のが本番運用の推奨。

---

## 3. 対応形式

| 区分 | 拡張子 | 扱い |
|------|--------|------|
| 推奨 | `.png` `.jpg` `.jpeg` `.webp` | LIST / texture 対象 |
| 互換（非推奨） | `.gif` `.svg` | 今も読む。validation は `legacy-format` warning |
| 非推奨・未使用 | `.heic` `.heif` `.tif` `.tiff` `.psd` `.ai` `.pdf` `.bmp` | LIST に使わない。`unsupported-format` warning。アプリは落とさない |

---

## 4. ファイル名

推奨:

- 半角英数字、ハイフン、アンダースコア、ドット
- 連番（例 `food_001.jpg` `gift_012.png` `flower_003.webp`）
- 80 文字以内

避けたい（**warning、fatal にしない**）:

- 日本語・全角記号・絵文字
- 極端に長い名前
- フォルダをまたいだ同名ファイル

日本語ファイル名は現状動く。本番投入では ASCII 連番を推奨する。

---

## 5. 70 カード化

- 目標表示枚数: **70**（`TARGET_LIST_CARD_COUNT`）
- 実画像が 70 未満なら `instanceId` を分けて複製（`sourceImageId` は元ファイル）
- 実画像が 70 超なら 70 枚にキャップ
- 0 枚なら fallback placeholder 70（LIST は落ちない）

---

## 6. 画像サイズ warning（非 fatal）

| 条件 | レベル |
|------|--------|
| 長辺 2500px 超 | warning |
| 長辺 4000px 超 | strong-warning |
| ファイル 8MB 超 | warning |

texture 失敗は LIST debug の `textureFailedCount`。失敗したカードは placeholder のまま。全体は落とさない。

---

## 7. validation 項目

- contentRoot / `content/images` の存在
- `images/list` の存在と枚数
- 対応 / 互換 / 未対応ファイル数
- ファイル名 warning
- 重複 ID / 同名ファイル
- ピクセル長辺・ファイルサイズ
- 70 カード化後の `expectedDisplayedCount`
- path から `categoryId` が取れるか
- `categories.json` / `content/Logo`

Phase 6 追加（warning、fatal にしない）:

- `content/images/food/` と JSON `contentFolders`
- `content/images/cover/`
- `content/text/`（`TOKYO FOOD.txt`）
- `content/animation/` mp4
- `content/fonts/` がある場合の Maison Neue 必須ファイル

表示枚数の現行値は **96**（このドキュメント執筆時の 70 から Phase 5.8 で更新）。check の `targetCardCount` / `expectedDisplayedCount` を見る。

---

## 8. check コマンド

```powershell
cd app
npm run build
npm run check:production-content
```

`contentRoot` 欠落または `content/images` 欠落だけ exit 1。その他は warning 付きで ok。

起動時 Main も同じ検証を log する（先頭 8 件 + strong-warning は全部）。

---

## 9. 本番画像の差し替え手順

1. アプリを終了する
2. `content/` をバックアップする
3. LIST 用画像を `content/images/list/` に置く（推奨形式・推奨ファイル名）
4. カテゴリ用は `content/images/{food|gift|flower}/`（Phase 4 modal 用。LIST に出したくなければ list/ だけ使う）
5. `cd app` → `npm run build` → `npm run check:production-content`
6. warning を確認（日本語名、巨大画像、未対応形式）
7. `npm run start:production` で LIST debug: `exploreSource=listImages`、`sourceImageCount`、`displayedImageCount`（現行 target 96）、`textureLoadedCount`
8. 問題なければ現場 `content/` を差し替えて再起動

Smoke:

- [ ] check が contentRoot / images で落ちない
- [ ] `images/list` を埋めたら `exploreSource` が `listImages`
- [ ] displayed は `targetCardCount`（現行 96）、texture 失敗が 0 または把握済み
- [ ] 4 面 LIST が前回どおり動く
