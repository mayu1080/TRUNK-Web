# IMAGE_ZOOM 画像とテキストの紐づけ

Phase 5.7 時点ではクライアント支給の画像別テキストは未確定。UI は仮 title / description を出し、差し替え口だけ先に置く。

## 推奨: 案A `content/image-details.json`

LIST の `sourceImageId`（探索画像 ID）と 1:1 で紐づける。SKU マスタである `products.json` とは分ける。

```json
{
  "items": [
    {
      "imageId": "food_001",
      "title": "TOKYO FOOD",
      "description": "説明文がここに入ります。"
    }
  ]
}
```

| 理由 | 内容 |
|------|------|
| LIST 画像数 ≠ 商品数 | 現状 LIST は `images/` 再帰スキャン。products.json はサンプル 2 件だけ |
| Category modal と共有できる | 同じ imageId で ZOOM と modal の本文を揃えられる |
| 未稿を許す | エントリ欠落時は category.title / category.description / 仮文へフォールバック |

解決順（実装予定）:

1. `image-details.json` の `imageId` 一致
2. カード自身の `title`（ファイル名由来など）
3. `categories.json` の `title` / `description`
4. Drawer 用 `label`
5. 仮文 `説明文がここに入ります。`

## 案B `products.json` を拡張 — 今回は採用しない

`id` / `imageId` を LIST 画像に一致させる案。商品詳細画面が本命になったときに再検討する。今は LIST 画像の大半が product 行を持たないため、空 SKU を量産することになる。

## 今回の仮実装

- `app/renderer/production/src/imageCopy.ts` が 2〜5 を解決する
- `categories.json` に `label`（Food / Gift / Flower）、任意の `title` / `description` を置いた
- IMAGE_ZOOM は category の title + 仮 description を表示する
- `image-details.json` の読込は未実装（Phase 6 で loader + validation）
