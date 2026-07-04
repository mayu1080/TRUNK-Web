# content/（外部コンテンツ）

アプリ本体（Electron ビルド）には含めません。現場 PC では `TRUNK.exe` と同じ階層に配置します。

## 開発時

リポジトリルートの `content/` をそのまま参照します（`app` 起動時のデフォルト）。

## 現場での差し替え

1. アプリを終了
2. `content/` をバックアップ
3. 新しい `content/` を配置
4. `TRUNK.exe` を再起動
5. ログで `manifest.version` を確認

## ファイル構成

| ファイル | 用途 |
|----------|------|
| `manifest.json` | エントリポイント・パス定義 |
| `categories.json` | カテゴリ定義 |
| `products.json` | 商品定義 |
| `images/list/` | PRODUCT_LIST 用画像（40〜70枚想定） |
| `images/{category}/` | カテゴリ別画像 |
| `thumbs/` | サムネイル |
| `videos/` | TOP / ANIMATION / CM 用（将来） |

## スキーマ

`docs/content-schema.md` を参照。

## サンプルについて

本フォルダの SVG は開発用プレースホルダのみです。顧客実素材はコミットしません。
