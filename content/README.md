# content/（外部コンテンツ）

アプリ本体（Electron ビルド）には含めません。現場 PC では `TRUNK.exe` と同じ階層に配置します。

## 開発時

リポジトリルートの `content/` をそのまま参照します（`app` 起動時のデフォルト）。

## 現場での差し替え

1. アプリを終了
2. `content/` をバックアップ
3. 新しい `content/` を配置（LIST 画像は `images/list/`）
4. 開発機では `cd app` → `npm run build` → `npm run check:production-content`
5. `TRUNK.exe` を再起動
6. ログ / Debug で `manifest.version`、`sourceImageCount`、`displayedImageCount`、`textureLoadedCount` を確認

## ファイル構成

| ファイル | 用途 |
|----------|------|
| `manifest.json` | エントリポイント・パス定義 |
| `categories.json` | カテゴリ定義 |
| `products.json` | 商品定義 |
| `images/list/` | PRODUCT_LIST 用画像（40〜70枚想定） |
| `images/{category}/` | カテゴリ別画像 |
| `thumbs/` | サムネイル |
| `ads.json` | 4面同期広告の紐づけ（既定 `ads/monitor-N.mp4`） |
| `animation.json` | 入場演出の紐づけ（`animation/monitor-N.mp4`）。`skipOnTouch` は無視（常に false） |
| `ads/` / `animation/` | 各 monitor 用 mp4。json のファイル名が無くても、フォルダ内の mp4 を割り当てる。1 本だけなら 4 面共通。欠落時はプレースホルダ（`fatalIfMissing` 既定 false） |
| `noise/` | LIST / ZOOM / Category modal 用のフィルムグレイン動画（mp4）。欠落時は DOM grain fallback |
| `monitor-layout.json` | 本番 4 画面の bounds / viewport offset（`npm run start:production` で必須） |

本番差し替え後の LIST 用は `images/list/` を正とする。空のときは `images/` 再帰スキャン（現行）。投入ルールと validation は [`docs/production/production-content-intake.md`](../docs/production/production-content-intake.md)。

## サンプルについて

本フォルダの SVG は開発用プレースホルダのみです。顧客実素材はコミットしません。
