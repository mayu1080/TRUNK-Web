# Production Content Schema

| 項目 | 内容 |
|------|------|
| 版 | 0.1 |
| 日付 | 2026-08-29 |
| フェーズ | Production Phase 0（設計のみ。schema 実装はしない） |
| 機械可読版 | [`production-content-schema.json`](./production-content-schema.json) |

現行開発用スキーマ: [`docs/content-schema.md`](../content-schema.md)（LIST / categories / products の最小形）。本番は本書が上書き・拡張する。

---

## 0. 原則

- 顧客素材は Electron ビルドに含めない。exe 横の `content/` を差し替える
- Main が起動時に検証し、`assetIndex` をメモリ生成。Renderer は描画中にフォルダを歩かない
- 8/20 の LIST 画像解決（`listImages` 優先、空なら `images/` 再帰）を継承しつつ、本番では **明示リスト + カテゴリ紐付け**を足す
- 動画は **モニターごと4本**が第一候補

---

## 1. フォルダ構成（想定）

```text
content/
  manifest.json
  monitor-layout.json          # または app 設定。配置は未決
  ads.json                     # 任意。無くても規約パスで可
  animation.json               # 任意
  categories.json
  products.json                # 将来 SKU 用。Category modal の第一データ源ではない
  ads/
    monitor-1.mp4
    monitor-2.mp4
    monitor-3.mp4
    monitor-4.mp4
  animation/
    monitor-1.mp4
    monitor-2.mp4
    monitor-3.mp4
    monitor-4.mp4
  images/
    list/                      # PRODUCT_LIST 用（現行参照を継承）
    food/
    gift/
    flower/
  categories/                  # 任意。カテゴリ専用画像を将来ここに分けてよい
  products/                    # 任意。現行は products.json のパス参照
  Logo/                        # IMAGE_ZOOM / Category modal 用。LIST には出さない
  thumbs/                      # 任意
```

旧 `videos/top` / `videos/cm` は `ads/` と `animation/` に役割を移す。移行期間は manifest で旧パスを読んでもよいが、新規配置は新パスを正とする。

現行リポジトリ直下 `Logo/` は開発暫定。本番正は `content/Logo/`。

---

## 2. manifest.json

現行フィールドを維持し、動画・ロゴ・layout を足す。

```json
{
  "version": "2026-08-29-001",
  "updatedAt": "2026-08-29T00:00:00+09:00",
  "categoriesFile": "categories.json",
  "productsFile": "products.json",
  "assetBaseDir": ".",
  "defaultListImageDir": "images/list",
  "adsFile": "ads.json",
  "animationFile": "animation.json",
  "logoDir": "Logo",
  "monitorLayoutFile": "monitor-layout.json"
}
```

`adsFile` / `animationFile` は省略可。省略時は §3 / §4 の規約ファイル名を使う。

---

## 3. ads（4-1）

論理: **1つの広告コンテンツを4画面に同期表示**する。面ごとに別広告を割り当てるスキーマではない。

素材ファイルの持ち方は Phase 2 で **候補 C + 規約パス（4本分割）** に確定。wall 1本 crop は使わない。

規約パス例:

```text
content/ads/monitor-1.mp4
content/ads/monitor-2.mp4
content/ads/monitor-3.mp4
content/ads/monitor-4.mp4
```

または `ads.json`:

```json
{
  "loop": true,
  "sync": "shared-clock",
  "tracks": [
    { "monitorId": 1, "file": "ads/monitor-1.mp4" },
    { "monitorId": 2, "file": "ads/monitor-2.mp4" },
    { "monitorId": 3, "file": "ads/monitor-3.mp4" },
    { "monitorId": 4, "file": "ads/monitor-4.mp4" }
  ]
}
```

比較対象: 4面連結1本。本番第一候補ではない。

検証: 4ファイル存在、デコード可能な拡張子（`.mp4` 第一候補）。Phase 2 は欠落時 placeholder + warn（`fatalIfMissing` 既定 false）。現場では json を `true` にして起動エラーにできる。

---

## 4. animation（4-2）

```text
content/animation/monitor-1.mp4
… monitor-4.mp4
```

または `animation.json`:

```json
{
  "skipOnTouch": false,
  "durationMs": 8000,
  "endPolicy": "duration",
  "tracks": [
    { "monitorId": 1, "file": "animation/monitor-1.mp4" },
    { "monitorId": 2, "file": "animation/monitor-2.mp4" },
    { "monitorId": 3, "file": "animation/monitor-3.mp4" },
    { "monitorId": 4, "file": "animation/monitor-4.mp4" }
  ]
}
```

`skipOnTouch` は常に `false`（仕様固定、json が true でも runtime は無視）。`endPolicy` は Phase 2 では `duration` 固定（all-ended は使わない）。

---

## 5. images / list（4-3）

### 5.1 現行（8/20）の継承

1. `assetIndex.listImages`（`defaultListImageDir` = `images/list`）
2. そのフォルダが空なら `content/images/` 再帰スキャン（`exploreImageCollector`）
3. raster 優先、target 70 枚まで duplicate 可

詳細・ファイル名 / 形式 / サイズ warning: [`production-content-intake.md`](./production-content-intake.md)。

本番でもこのフォールバックを残してよい。現場が `images/list` を埋めたらそれを正とする。

### 5.2 本番で足すこと

LIST カードと Category modal で **同じファイルを参照できる**こと。各画像に安定 `id` を付ける。

```json
{
  "id": "food_grill_01",
  "relativePath": "images/food/grill_01.jpg",
  "fileName": "grill_01.jpg",
  "categoryId": "food"
}
```

`id` はパスから生成してもよいが、差し替えで変わらない明示 ID を将来推奨する。

LIST は全カテゴリ混在でよい（0820 と同じ探索空間）。Category modal は `categoryId` または `categories[].imageIds` で絞る。

---

## 6. categories（4-4）

Drawer ラベルと modal の title / description / 画像列を持つ。

```json
[
  {
    "id": "food",
    "label": "Food",
    "title": "TOKYO FOOD",
    "description": "",
    "imageDir": "images/food",
    "imageIds": ["food_grill_01", "food_sushi_02"],
    "order": 1
  }
]
```

| フィールド | 必須 | 用途 |
|------------|:----:|------|
| `id` | ✓ | Drawer / 状態 |
| `label` | ✓ | Drawer 行（0820 は Food / Gift / Flower） |
| `title` | ✓ | modal 見出し（例 `"TOKYO FOOD"`） |
| `description` |  | modal 本文。**未稿可（空文字）**。将来入る前提 |
| `imageDir` |  | 旧互換・スキャン用 |
| `imageIds` |  | modal のスライド順。空なら `imageDir` または LIST 同一プールから `categoryId` 一致を使う |
| `order` | ✓ | 表示順 |

`imageIds` が空のときの解決順（第一候補）:

1. `imageDir` 内の画像を名前順
2. それも空なら LIST ソースのうち `categoryId` 一致
3. それでも空なら modal は empty 状態 UI

これで「現状 LIST と同じ素材」と「将来カテゴリ別」の両方を schema で表現する。

`products.json` は残す（SKU 詳細の将来）。Category modal の第一表示は **categories + images** であり、商品マスタ必須ではない。

IMAGE_ZOOM / 将来の画像別本文は **案A `content/image-details.json`** を推奨する。理由と解決順は [`production-image-copy.md`](./production-image-copy.md)。`products.json` を LIST 画像 1:1 に拡張する案Bは今は採用しない。

---

## 7. Logo（4-5）

```text
content/Logo/
```

用途: **IMAGE_ZOOM** と **Category modal** のボックスロゴのみ。LIST には原則表示しない。

取得規則（現行 `logoAsset.ts` を contentRoot 基準に移す）:

- ディレクトリ内の `.png` / `.svg` / `.jpg` / `.jpeg`
- **`LOGO_TEXT.*` を最優先**（IMAGE_ZOOM 白カード左上）
- それ以外は png > svg > jpg
- 装飾のみ。タップハンドラなし


---

## 8. monitor-layout.json

アーキテクチャ §3.2 の物理配置。content に置くか app 設定にするかは未決。スキーマ例:

```json
{
  "version": "1",
  "boundsMatchTolerancePx": 8,
  "touchMonitorCount": 4,
  "managementMonitorExcluded": true,
  "monitors": [
    {
      "monitorId": 1,
      "x": 0,
      "y": 0,
      "width": 1080,
      "height": 1920,
      "orientation": "portrait",
      "viewportOffsetX": 0,
      "viewportOffsetY": 0,
      "scale": 1
    }
  ]
}
```

管理モニターは `monitors` に含めない。

---

## 9. 起動時検証

Main は少なくとも次を確認する。

1. `content/` 存在
2. `manifest.json` パース
3. `categories.json` 配列
4. ads 4本 / animation 4本のファイル存在（B案）
5. LIST 用画像が1枚以上（0枚は warning + fallback カードか起動エラー。0820 は fallback。本番方針は未決）
6. `Logo/` は任意。無い場合 ZOOM/modal はロゴなしで成立させる（warning）
7. 各 `imageIds` が実ファイルを指す。欠落は warning + その ID をスキップ

エラー時は Renderer 4面を出す前に Main でダイアログ（現行 content エラーと同じ方向）。

---

## 10. 差し替え

1. アプリ終了（または全体 AD_IDLE 中でも、差し替えは再起動を正とする）
2. `content/` バックアップ
3. 新 `content/` 配置
4. 再起動
5. ログで `manifest.version` 確認

遠隔同期は現行 architecture §12 どおり将来。MVP 外。

---

## 11. 未決（content）

1. LIST 0枚時に起動するか
2. 動画欠落時に起動するか
3. `monitor-layout.json` を content に置くか
4. Logo ファイル名固定か自動 pick か
5. 画像 ID の安定化（パス由来 vs 明示 json）
6. `products.json` を Category modal にいつ接続するか（今はしない）
7. 動画コーデック・解像度の現場規定
