# Production Phase 6 report

| 項目 | 内容 |
|------|------|
| 日付 | 2026-08-31 |
| 対象 | `TRUNK_DEMO=production` 本番 content 接続 |
| チェック | `cd app` → `npm run build` → `npm run build:production` → `npm run check:production-content` → `npm run check:production-phase6` |

関連: [`production-phase516-content-inventory.md`](./production-phase516-content-inventory.md) / [`production-content-intake.md`](./production-content-intake.md) / [`production-app-feedback-report.md`](./production-app-feedback-report.md)

---

## やったこと

Phase 5.16 以降で入っていた LIST / text / Food cover / ANIMATION を、Phase 6 の正式接続として validation・Debug・docs まで揃えた。LIST / IMAGE_ZOOM / CategoryDrawer / Category modal の見た目は変えていない。

後続 FB で確定した仕様は Phase 6 本文の例より優先する。

| Phase 6 本文 | 採用した確定仕様 |
|--------------|------------------|
| フォルダ境界に共通 cover を繰り返し挟む | 先頭は `表紁E.png`（表紙）。以降は `cover/{コース名}.png` を JSON 順で各コースの 1 枚目にする |
| cover を dots に含める | Category modal の dots は削除済みのまま（swipe / loop 対象ではある） |
| フォルダは名前順 | `categories.json` の `contentFolders` を優先 |

---

## 変更したファイル

- `app/electron/content/contentImageValidation.ts` — food / cover / text / animation / fonts を warning 検証
- `app/electron/content/contentService.ts` — validation log に Phase 6 項目
- `app/electron/production/videoPlaylist.ts` — json パス欠落時、animation フォルダの 1 本を 4 面に割り当て
- `app/shared/types.ts` / `app/renderer/production/src/productionApi.ts` — validation 型
- `app/renderer/production/src/App.tsx` — Debug 表示
- `app/scripts/check-production-content.js` / `app/scripts/check-production-phase6.js`
- `app/package.json` / `app/README.md`
- `docs/production/production-content-intake.md` / 本レポート

LIST 読み込み本体（`scanListImages` / `contentCards` / `instanceId`）と shared text / Food gallery は既存接続を維持。

---

## LIST 画像

| 項目 | 値 |
|------|-----|
| 読み込み元 | `content/images/list/` 直下 |
| 読み込み枚数 | **53** PNG（`exploreSource=listImages`） |
| 表示枚数 | **96**（`targetCardCount`）。53 < 96 なので全枚使用 + 複製 43 |
| 抽出 | `cardExpandSeed=1234` の Fisher–Yates。今回は枚数が target 未満のため抽出キャップは起きない |
| 配置 | `buildScenePlacements`、seed **1234**。4 面で同じ並びにするため起動ごとに変えず、プロセス内も固定 |
| AD_IDLE 復帰 | LIST は unmount するが seed が同じなので再入場でも同じ抽出・同じ初期配置 |
| instanceId | `card_001` … `card_096` |
| sourceImageId | `list_001` …（複製しても同じ source。IMAGE_ZOOM はこれで元画像に紐づく） |
| 未対応形式 | LIST 直下は PNG のみ。`images/food/sample_food_01.svg` などは LIST ソースに入らない |

---

## Image_ZOOM / Category modal text

| 項目 | 値 |
|------|-----|
| 読み込み元 | `content/text/TOKYO FOOD.txt` |
| 分割 | 先頭の空行以外の 1 行目 = title（引用符維持）。残り = description（改行維持、`pre-line`） |
| 適用 | IMAGE_ZOOM と Category modal。Food / Gift / Flower は同じ 1 本 |
| フォント / レイアウト | 未変更。modal は description 欄だけスクロール |

コース別 txt はまだ無いので未接続（FB レポートの今後の更新）。

---

## Food Category modal / cover

検出フォルダ（JSON 順）: `山吹` `朱` `純白` `若草` `玄` `白緑` `Option`

cover ディレクトリ: `yamabuki.png` `akari.png` `gen.png` `byakuroku.png` `jyunpaku.png` `wakakusa.png` `hyoshi.png`（`Option.png` なし）

slide 構成:

```text
hyoshi.png
→ yamabuki.png → yamabuki/*
→ akari.png → akari/*
→ jyunpaku.png → jyunpaku/*
→ wakakusa.png → wakakusa/*
→ gen.png → gen/*
→ byakuroku.png          （images/food/byakuroku は 0 枚なので表紙のみ）
→ Option/*          （Option.png が無いので写真から）
→ loop
```

cover は通常スライド。swipe / loop 対象。テキスト欄は出す（共通 `TOKYO FOOD.txt`）。コース表紙以降はコース名をテキスト欄上に出す。dots は出さない。

Gift / Flower は `insertCoverBetweenFolders: false` のまま。

---

## ANIMATION mp4

| 項目 | 値 |
|------|-----|
| ファイル | `content/animation/LogoMotion_Trunk.mp4` 1 本 |
| 割り当て | `animation.json` が 4 monitor とも同じパス。1 本なので全画面共通 |
| 再生 | AD_IDLE touch → ANIMATION。touch skip なし。`ended` で PRODUCT_LIST。LIST preload は継続 |
| 欠落時 | json/規約パスが無いとき、フォルダ内の 1 本を 4 面に使う。0 本なら placeholder + warning（fatal ではない） |
| 複数本 | `monitor-N.mp4` があれば monitorId 順。それ以外はファイル名順で割り当て |

---

## validation 更新

`npm run check:production-content` が次も出す（不足は warning。fatal は contentRoot / `content/images` 欠落のみ）。

- `images/list/` `images/food/` `images/food/*/` `images/cover/` `text/` `animation/` `Logo/` `fonts/`
- `textLoaded` / `textSource` / `animationVideoMode` / `animationVideoFiles`
- `foodFolderCount` / `categoryFoodSlideCount` / `coverImageCount` / `fontFileCount`

今回の実測で出る warning 例: 日本語ファイル名、list と food の同名、`images/food/白緑` 空、`Option` に cover なし、food 直下 svg。

---

## Debug 追加

`listImageCount` `listSourceMode` `categoryFoodFolderCount` `categoryFoodSlideCount` `coverImageCount` `textLoaded` `textSource` `animationVideoMode` `animationVideoFiles`

---

## 残る Phase 6 課題

- Gift / Flower の cover 挟み
- コース別テキスト（フォルダ内 txt）
- `Option.png` が cover に無い
- `images/food/byakuroku` が空
- 起動ごとの再ランダムは 4 面同期のため未採用（seed 1234 固定）
- packaging / installer は対象外
- `content/text/TOKYO FOOD.txt` は ASCII だがスペース付き（今回は非 ASCII のみ対象にした）
