# content/ スキーマ（外部コンテンツ）

> アプリ本体（Electron ビルド）には含めない。現場 PC の `content/` フォルダに配置する。
> 詳細アーキテクチャは `docs/architecture.md` §4〜§6 を参照。

## フォルダ構成

```text
content/
  manifest.json
  categories.json
  products.json
  images/
    list/          # PRODUCT_LIST 用（40〜70枚想定）
    food/
    gift/
    flower/
  videos/
    top/
    animation/
    cm/
  thumbs/
```

## manifest.json

| フィールド | 型 | 説明 |
|------------|-----|------|
| `version` | string | コンテンツセット識別子 |
| `updatedAt` | string | ISO8601 |
| `categoriesFile` | string | manifest からの相対パス |
| `productsFile` | string | manifest からの相対パス |
| `assetBaseDir` | string | 通常 `"."` |
| `defaultListImageDir` | string | LIST 画像ディレクトリ |
| `cmVideoDir` | string | CM 動画ディレクトリ |

## categories.json

配列。各要素:

| フィールド | 型 | 必須 |
|------------|-----|------|
| `id` | string | ✓ |
| `label` | string | ✓ |
| `description` | string | |
| `imageDir` | string | ✓ |
| `order` | number | ✓ |

## products.json

配列。各要素:

| フィールド | 型 | 必須 |
|------------|-----|------|
| `id` | string | ✓ |
| `categoryId` | string | ✓ |
| `title` | string | ✓ |
| `subtitle` | string | |
| `description` | string | |
| `images` | string[] | ✓（content  root からの相対パス） |
| `thumbnail` | string | |
| `tags` | string[] | |

## バリデーション（起動時）

Main process が以下を検証する:

1. `content/` ディレクトリ存在
2. `manifest.json` 存在・パース可能
3. `categories.json` / `products.json` 存在・配列形式
4. 各 JSON 内パスが実ファイルとして存在

エラー時は Renderer 起動前に Main でメッセージ表示。

## 差し替え手順（現場）

1. アプリを終了（または無操作 TOP 復帰を待つ）
2. `content/` をバックアップ
3. 新しい `content/` を配置（またはフォルダごと差し替え）
4. `TRUNK.exe` を再起動
5. ログで `manifest.version` を確認

将来: `content_next/` → 検証 → アトミック差し替え（`architecture.md` §12）
