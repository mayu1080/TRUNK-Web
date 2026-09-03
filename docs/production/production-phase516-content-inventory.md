# Production Phase 5.16: content inventory / 仕様理解 / 不明点

| 項目 | 内容 |
|------|------|
| 日付 | 2026-08-31 |
| 対象 | `content/` 更新後の実体確認。実装はしていない |
| 範囲 | LIST / Food フォルダ構造 / cover / text / ANIMATION。schema 大改修なし |

`demo-0820` / `LIST_demo` / UI / LIST 挙動 / overlay 独立性 / 120s Non-Touch は未変更。

---

## 0. 結論（先に）

- `content/images/list/` は **56 枚の PNG** が入った。既存の優先順位どおり、再起動すれば LIST は `exploreSource=listImages` になる。**LIST 読み込み自体にコード変更は不要。**
- 表示は現行どおり **target 96**。56 < 96 なので全枚使用 + 複製 40。抽出は発生しない。
- `content/text/` は **`TOKYO FOOD.txt` 1 本のみ**。IMAGE_ZOOM / Category modal の本接続は未実装。
- Food は **7 コンテンツフォルダ**（例示の Option / 玄 / 白緑 だけではなく、山吹・朱・純白・若草もある）。
- `content/images/cover/` は **1 枚**（TOKYO FOOD 表紙）。Category modal にはまだ使っていない。
- `content/animation/` は **`LogoMotion_Trunk.mp4` 1 本**（約 5 秒）。`animation.json` が期待する `monitor-1..4.mp4` は無い。欠落時は現行どおり placeholder。

この段階では実装しない。下記の不明点が埋まってから Phase 6 に入る。

---

## 1. `content/images/list/`

| 項目 | 値 |
|------|-----|
| 枚数 | **56**（直下のみ。サブフォルダなし） |
| 形式 | すべて `.png`（推奨形式） |
| 読み込み対象外 | なし（画像以外なし） |
| 既存スキャン | `scanListImages` は list 直下のみ。recursive ではない |

命名:

- プレフィックス `sapporofood_260723_`
- 日本語コース名（玄 / 山吹 / 若草 / 朱 / 純白 / 白緑）と `_cover` を含むファイルが多い
- スペースあり: `sapporofood_260723_TOKYO FOOD.png` → filename warning
- 破損っぽい名前: `sapporofood_260723_表紁E.png`（`表紙.png` の文字化けの可能性。UTF-8 `表` + `紁` + `E`）
- `sapporofood_260723_若草over.png`（`若草cover` の `c` 欠け？）

validation で出ると予想される warning（fatal ではない）:

- `filename-not-recommended`（日本語・スペース）× ほぼ全枚
- `duplicate-basename` — **list と food で同名 55 組**（同じファイルを 2 箇所に置いている）
- `using-recursive-scan` は **出ない**（list が空ではないため）
- 長辺 2500px 超: LIST PNG は **0**（サンプル測定）
- 8MB 超: LIST **0**

### displayedImageCount / targetCardCount

| キー | 現行 |
|------|------|
| `TARGET_LIST_CARD_COUNT` / `listConfig.targetCardCount` | **96** |
| `cardExpandSeed` | **1234**（固定） |
| 今回の source | 56 |
| 予想 displayed | **96**（56 unique + 40 duplicate） |
| `cardGenerationMode` | `content-duplicated` |
| `instanceId` | `card_001` … `card_096` |
| `sourceImageId` | `list_001` …（ファイル由来。複製しても同じ source） |

ランダム:

- **抽出**は seed 固定済み（`expandToTarget` の Fisher–Yates）。ただし 56 < 96 なので今回は抽出せず全枚使う。
- **空間配置**は `exploreController` の `Math.random()`。起動ごとに位置が変わる。seed なし。

LIST に表紙・コース cover も入っている。これが意図ならそのままでよい。

---

## 2. `content/images/food/`

直下に開発用 `sample_food_01.svg` が残っている。raster があるので Category modal 現行ロジックでは **使わない**。

サブフォルダ（コンテンツ単位）:

| フォルダ | PNG 枚数 | 同居テキスト |
|----------|----------|----------------|
| Option | 6 | なし |
| 玄 | 9 | なし |
| 山吹 | 10 | `YAMABUKIテキスト.txt` |
| 若草 | 9 | `WAKAKUSAテキスト.txt` |
| 朱 | 10 | `AKARIテキスト.txt` |
| 純白 | 10 | `JYUNPAKUテキスト.txt` |
| 白緑 | 1（`*_cover.png` のみ） | なし |
| **計** | **55 PNG** | 4 txt |

現行 `collectCategoryImages` は `imageDir` を再帰し、パス順（`localeCompare('en')`）で平坦化する。**フォルダ境界も cover 挿入もない。**

現行ソート（先頭文字の Unicode）:

1. Option
2. 山吹
3. 朱
4. 玄
5. 白緑
6. 純白
7. 若草

ユーザー例（Option → 玄 → 白緑）とは一致しない。7 フォルダ全部を出すかも未確認。

Option 内に `sapporofood_260723_TOKYO FOOD.png` がある。これは `content/images/cover/` と同じ表紙。cover を挟むと **表紙が連続する**可能性がある。

各フォルダ内にも `*_cover.png` がある（コース表紙）。`content/images/cover/` の共通表紙とは別物。

---

## 3. Gift / Flower（参考。今回の仕様文は Food 中心）

Gift:

| フォルダ | 画像 | テキスト |
|----------|------|----------|
| カタログギフト | ①.jpg ②.jpg ③.jpg | カタログギフトテキスト.txt |
| パウンドケーキ | ①.png | パウンドケーキテキスト.txt |
| ふりかけ | ①.jpg ②.jpg ③.jpg | ふりかけテキスト.txt |
| 直下 | `sample_gift_01.svg` | — |

`①.jpg` などがフォルダをまたいで同名 → duplicate-basename warning。現行 gallery はパスが違うので両方出る。

Flower: `NATURE/` に `NATURE①.png`（2000×1497）と `NATUREテキスト.txt` のみ。現行 modal は 1 枚なので peek / swipe / dots なし。

---

## 4. `content/images/cover/`

| 項目 | 値 |
|------|-----|
| 枚数 | **1** |
| ファイル | `sapporofood_260723_TOKYO FOOD.png`（1754×1241） |
| 用途（案） | Food のコンテンツフォルダ切替時に挟む表紙 |
| 現行コード | **未参照** |

同じファイルが `images/list/` と `images/food/Option/` にもある。

---

## 5. `content/text/`

| ファイル | 形式 | 文字コード | 改行 |
|----------|------|------------|------|
| `TOKYO FOOD.txt` のみ | `.txt`（`.md` / `.json` なし） | UTF-8、BOM なし | CRLF |

内容:

```text
"TOKYO FOOD"

フレンチを軸に、東京らしさと和の美意識、季節感を表現した、
TRUNK(HOTEL)ならではの料理スタイルです。
…
```

- 1 行目: 引用符付きタイトル
- 空行
- 以降: 本文（改行あり、Markdown ではない）

`content/text/` には Gift / Flower 用ファイルはない。ユーザー指示「3 カテゴリ同じテキストでよい」なら、この 1 本を共用する形になる。

一方、**コンテンツ単位のテキストは画像フォルダ側に既にある**（朱 / 若草 / 山吹 / 純白、Gift 3 種、Flower NATURE）。今回の仕様は `content/text/` を正とする、と読める。フォルダ内 txt は未使用のまま残る。

現行表示:

- IMAGE_ZOOM: `imageCopy.ts`（card title → category title → 仮 description）。`content/text/` は未読
- Category modal: `categories.json` の `title` / `description`（プレースホルダ長文）。スライドごとのテキストは出していない
- description 領域は `overflow-y: auto` 済み。長文は流し込める。ただし CSS 既定は改行を畳む（`white-space` 未指定）

LIST 画像の `categoryId` はパスから **`list`** になる。Food カテゴリには紐づかない。共通テキスト接続なら category 解決は不要。

---

## 6. `content/animation/` と `animation.json`

実ファイル:

```text
content/animation/
  .gitkeep
  LogoMotion_Trunk.mp4   ≈ 3.3 MB、Shell 上の長さ 00:00:05
```

`animation.json`（現行）:

```json
{
  "durationMs": 8000,
  "safetyCapMs": 10000,
  "fatalIfMissing": false,
  "tracks": [
    { "monitorId": 1, "file": "animation/monitor-1.mp4" },
    { "monitorId": 2, "file": "animation/monitor-2.mp4" },
    { "monitorId": 3, "file": "animation/monitor-3.mp4" },
    { "monitorId": 4, "file": "animation/monitor-4.mp4" }
  ]
}
```

関係:

- json の 4 パスは **どれも存在しない**
- 実行時は 4 面とも `track.found=false` → **placeholder**（Phase 2 どおり。アプリは落ちない）
- 完了は **json の 8000ms タイマー**（実動画の ended ではない）
- 実ファイルが 5 秒なら、接続後も json を 8000 のままにすると **末尾 3 秒は静止 / 黒**になりうる
- `skipOnTouch` は仕様どおり常に false

AD_IDLE 用 `content/ads/` は `.gitkeep` のみ（今回の範囲外）。`content/images/cm/` に `映像①.mp4` / `映像②.mp4` が残っているが、list/ が埋まったので LIST ソースには入らない。

LIST preload: **既に ANIMATION 中に ExploreHost を mount**している。mp4 本接続してもこの構造は維持できる。

---

## 7. `categories.json` との関係

| カテゴリ | `imageDir` | 現行 gallery | 今回の案 |
|----------|------------|--------------|----------|
| food | `images/food` | 再帰平坦 55 PNG | フォルダ単位 + cover 挟み |
| gift | `images/gift` | 再帰平坦（①②③ が複数フォルダ） | テキストは共通で可。cover 挟みは未指定 |
| flower | `images/flower` | 1 PNG | 同上 |

`title` / `description` はまだプレースホルダ。本接続後は `TOKYO FOOD.txt`（またはフォルダ内 txt）がこれに代わる想定。

`products.json` はサンプル 2 件のまま。IMAGE_ZOOM / modal の正にはしない（既存方針）。

---

## 8. 実装方針案（未実施）

確認が返ってから着手する。コードを先に動かさない。

### 8.1 IMAGE_ZOOM テキスト

- Main が `content/text/TOKYO FOOD.txt` を読む（UTF-8）
- 1 行目の引用符を外して `title`、残りを `description`
- 全 LIST カードで同じコピー（画像ごと紐づけは今はしない）
- フォントは変更しない
- 改行は `white-space: pre-line` が必要（確認待ち）
- kicker（Food / Gift / Flower）を残すかは確認待ち

### 8.2 Category modal テキスト

- 当面 3 カテゴリとも同じ `TOKYO FOOD.txt`
- title / description はモーダル下部の既存欄へ。カード高さは変えない
- フォルダ内 `*テキスト.txt` は Phase 6 では読まない（確認待ち）

### 8.3 Food carousel の cover 挟み

Main の `getCategoryGallery('food')` だけ順序を組む案:

```text
cover
  + food/<folderA> の画像（順）
cover
  + food/<folderB> の画像
…
```

- cover は carousel の **1 スライド**（swipe 対象）
- 循環ループに含める（既存 clone ロジックと両立）
- dots に含めるかは確認待ち
- cover 中の title/description はカテゴリ共通テキストのまま、が最小変更
- Gift / Flower は今は平坦のまま（確認待ち）
- `sample_*.svg` は引き続き除外

フォルダ順と「フォルダ内 `*_cover.png` を残すか」が最大の分岐。

### 8.4 ANIMATION mp4

最小接続:

- `animation.json` の 4 track をすべて `animation/LogoMotion_Trunk.mp4` にする（同一ファイル 4 面同期）
- `durationMs` を実長（約 5000）に合わせる。safetyCap は +2s 程度
- `fatalIfMissing` は false のまま
- LIST preload は触らない

4 本分割が来るまでの暫定。

### 8.5 LIST

実装不要（再起動で 56→96）。seed / 配置ランダムは現行維持で足りる。壊れたファイル名だけ運用で直せる。

---

## 9. 実装前に確認が必要な不明点

優先度高:

1. **Food の 7 フォルダを全部出すか。** 例示は Option / 玄 / 白緑 のみ。
2. **フォルダ順。** ファイルシステム / 名前 / JSON 明示のどれか。現行 Unicode 順は例示と違う。
3. **挟む cover は `images/cover/` の 1 枚を毎回同じでよいか。**
4. **フォルダ内 `*_cover.png` は通常スライドとして残すか、除外するか。** Option の TOKYO FOOD.png は共通 cover と重複する。
5. **白緑は画像 1 枚（cover 風）だけ。** cover 挟み後に表紙が続く。出してよいか。
6. **cover スライドに dots / swipe / ループ / テキストを出すか。**
7. **Gift / Flower にも cover 挟みを適用するか。** 今の文面は Food のみ。
8. **IMAGE_ZOOM / modal は `TOKYO FOOD.txt` 1 本でよいか。** フォルダ内コース文（朱・若草…）は後回しでよいか。
9. **1 行目 `"TOKYO FOOD"` の引用符を外すか。** 改行を保持するか（plain text vs Markdown → 実体は plain）。
10. **ANIMATION は 1 本を 4 面に同じ再生でよいか。** `durationMs` を 5s に合わせるか。
11. **LIST 抽出 seed は現行 1234 のままでよいか。** 配置の `Math.random()`（起動ごとに変わる）でよいか。
12. **`表紁E.png` / `若草over.png` をこのまま LIST に出してよいか。**

優先度中:

- IMAGE_ZOOM の kicker（カテゴリ名）を残すか
- `categories.json` の placeholder description を txt に置き換えるか、json は残すか
- 同名ファイルが list と food にあること（validation warning は出る。動作は別ソースなので問題ではない）

---

## 10. 次に実装してよい範囲（確認後）

確認が返ってから、この順が安全:

1. ANIMATION: json のパスと duration だけ合わせて mp4 本接続（UI / overlay 非変更）
2. 共通テキスト loader → IMAGE_ZOOM と Category modal に同じ title/description
3. Food gallery のフォルダ単位 + cover 挿入（Gift/Flower は据え置き、確認次第）

まだやってはいけない:

- schema 大改修（`image-details.json` 必須化など）
- UI デザイン変更
- LIST 速度 / FO / density 変更
- `globalScene` / `localOverlay` / overlay independence / 120s Non-Touch
- フォルダ内コース文の本接続（8 が「後回し」なら）
