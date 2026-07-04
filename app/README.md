# app/（Electron + Web）

Phase 2: 外部 `content/` 読み込みレイヤー。

## 前提

- Node.js 20+
- リポジトリルートに `content/` フォルダがあること

## セットアップ

```powershell
cd app
npm install
```

## 起動（開発）

```powershell
npm start
```

起動時に Main process が `../content/` を読み込み、`assetIndex` を生成します。
dev 用ウィンドウに JSON サマリが表示されます（PRODUCT_LIST UI ではありません）。

## contentRoot

| 条件 | パス |
|------|------|
| 開発（デフォルト） | リポジトリ `./content` |
| パッケージ後 | `{exeDir}/content` |
| 上書き | 環境変数 `TRUNK_CONTENT_ROOT` |

## エラーテスト

| ケース | 手順 |
|--------|------|
| content 欠落 | `content/` をリネームして起動 → エラーダイアログ |
| manifest 欠落 | `manifest.json` をリネーム → エラーダイアログ |
| 不正 JSON | `categories.json` を `{}` に → エラーダイアログ |
| 参照ファイル欠落 | products の images パスを存在しないパスに → エラーダイアログ |
| 40枚未満 | 現サンプル（2枚）→ 起動成功 + warning ログ |

## preload API

| API | 説明 |
|-----|------|
| `getConfig()` | contentRoot, isPackaged, monitorId |
| `getManifest()` | manifest.json |
| `getCategories()` | categories 配列 |
| `getProducts()` | products 配列 |
| `getAssetIndex()` | 起動時生成済み index |
| `getContentFileUrl(path)` | file:// URL |
| `logEvent(event)` | Main へログ |

Renderer から `fs` は使用不可。

## モジュール構成

```text
electron/content/
  contentRoot.ts      # contentRoot 解決
  loaders.ts          # JSON 読込・検証
  assetIndexBuilder.ts
  contentService.ts   # 起動時初期化
  errors.ts
electron/preload.ts
electron/main.ts
shared/types.ts
```

## 触っていないもの（Phase 2 スコープ外）

- PRODUCT_LIST 描画
- 画面遷移 / screenState
- 4面同期 IPC（Phase 7）
- 遠隔 content 同期
