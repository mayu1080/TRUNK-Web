# app/（Electron + Web）

Phase 2: 外部 `content/` 読み込みレイヤー。

## 前提

- Node.js **22.12+**（`electron@43` の engines。20 では `npm ci` が失敗しうる）
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

### 8/20 single-monitor demo（`TRUNK_DEMO=0820`）

通常の `npm start` は従来どおり `state-dev.html`（複数 window）です。
8/20 体験デモは別コマンドです。

別 Windows へフォルダごと渡す場合はリポジトリ直下の `setup-0820.bat` / `launch-0820.bat`（詳細は `docs/0820-demo/transfer-test.md`）。

手動:

```powershell
cd app
npm ci
cd renderer/demo-0820
npm ci
cd ../..
npm run start:0820
```

カラー版（白黒フィルタなし、本体は変更しない）:

```powershell
cd app
npm --prefix renderer/demo-0820-color ci
npm run start:0820-color
```

または `launch-0820-color.bat`。

1 window / `TRUNK_MONITOR_COUNT=1`。React / Three / framer-motion はこの renderer に閉じます。

### Production shell（`TRUNK_DEMO=production`）

**現場プレ実機（Phase 7）の最小手順:** [`docs/production/phase7-site-preflight.md`](../docs/production/phase7-site-preflight.md) → QA [`phase7-site-qa-checklist.md`](../docs/production/phase7-site-qa-checklist.md) → 仕様 [`production-runtime-spec.md`](../docs/production/production-runtime-spec.md)。

本番 4 window は `npm run start:production`（リポジトリ直下 `launch-production.bat`）。管理画面用に 5 つ目の window は出さない。`start:production:preview` は 1 画面 UI 確認専用。

Phase 5.15: Category modal は白いカード型ギャラリー（幅は 1window に近づけ、高さは IMAGE_ZOOM より低く）。UI 確認は `npm run start:production:preview`（1 window）。既定は **review** + **frameless**。本番 `start:production` は常に frameless、初期シーンは **AD_IDLE**。single preview のみ LIST 直行（AD / ANIMATION 確認は下記）。`globalScene` / `localOverlay` / 120秒 Non-Touch / content validation は維持。

```powershell
cd app
npm --prefix renderer/production ci
```

コマンドの使い分け:

```powershell
# 日常の UI 確認（single-window visual QA。1080×1920 論理サイズ、拡縮可能）
npm run start:production:preview

# 上と同じ alias
npm run start:production:preview:single

# 4window 状態確認（globalScene / overlay independence / monitorId / 120秒 idle）
npm run start:production:preview:multi

# 本番相当の 4window 起動（実機・本番用。preview env は付けない）
npm run start:production
```

single-window preview: monitorId=1、production renderer、**初期シーンは PRODUCT_LIST**（AD_IDLE / ANIMATION をスキップ。LIST / overlay の UI 確認用）。既定は review。`D` / `G` で debug。debug 中は `Show debug` または `P` でパネル。

初期シーン:

| 起動 | 開始 | AD_IDLE / ANIMATION |
|------|------|---------------------|
| `npm run start:production` | **AD_IDLE** | 通常フロー。touch → ANIMATION → PRODUCT_LIST。消えない。 |
| `npm run start:production:preview`（single） | PRODUCT_LIST 直行 | 意図的スキップ。下記で確認可。 |
| `npm run start:production:preview:multi` | **AD_IDLE** | 4 window で本番と同じ開始。 |

preview で AD / ANIMATION を見る:

- `npm run start:production:preview:multi`（本番と同じ AD_IDLE 開始）
- または single preview で `1` → AD_IDLE、`2` → ANIMATION、`3` → PRODUCT_LIST（debug chrome なしでもキーは効く）。AD_IDLE 中に画面を tap すると ANIMATION。

表示差分:

- `npm run start:production` … in-app debug 非表示（review）。Windows title bar / `TRUNK production` **なし**（frameless）。
- `npm run start:production:preview` … 同上の in-app review。title bar も **既定なし**（frameless）。確認で bar が必要なら `$env:TRUNK_PRODUCTION_PREVIEW_FRAME = "1"`。
- preview debug（`D`）… badge / BOUNDS MISMATCH / Show debug を表示。title bar は FRAME=1 のときだけ。

本番で非表示: topbar、Show debug、debug panel、Windows title bar。frameless 4window は monitor-layout の bounds。kiosk 排他フルスクリーンは未実装。

4window preview は従来の `start:production:preview` と同じタイル配置。通常の見た目確認には使わない。

任意:

```powershell
$env:TRUNK_PRODUCTION_PREVIEW_MODE = "portrait"   # 1080×1920。fullhd なら 1920×1080
$env:TRUNK_PRODUCTION_PREVIEW_SCALE = "0.5"     # 省略時は work area に収まる scale
$env:TRUNK_PRODUCTION_PREVIEW_WINDOWS = "single" # または multi
$env:TRUNK_PRODUCTION_PREVIEW_FRAME = "1"      # 任意。preview で title bar を出す
npm run start:production:preview
```

開発で idle 秒を短くする:

```powershell
$env:TRUNK_PRODUCTION_IDLE_SECONDS = "8"
npm run start:production
```

`content/monitor-layout.json` が必須。`start:production` で 1 ディスプレイかつ preview env が無い場合は従来の小さい 2×2 fallback。preview コマンドは unpackaged ならディスプレイ数に関係なく preview 配置を使う（packaged では無効）。
`content/ads.json` / `content/animation.json` は 4 monitor 分のファイルを指します。animation が **1 本だけ**なら全 monitor で同じ mp4 を使います。無い場合はプレースホルダ表示と warn（`fatalIfMissing` 既定 false）。

チェック:

```powershell
npm run build
npm run check:production-overlay
npm run check:production-phase2
npm run check:production-content
npm run check:production-phase4
npm run check:production-phase5
npm run check:production-phase55
npm run check:production-phase57
npm run check:production-phase58
npm run check:production-phase59
npm run check:production-phase510
npm run check:production-phase511
npm run check:production-phase514
npm run check:production-phase515
npm run check:production-phase516
npm run check:production-phase6
npm run check:production-phase7
npm run check:production-brand-fonts
```

画像投入ルール: [`docs/production/production-content-intake.md`](../docs/production/production-content-intake.md)。`check:production-content` は `contentRoot` / `content/images` 欠落だけ exit 1。サイズ・ファイル名は warning。

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

## 触っていないもの（Phase 6 以降）

- 本番 content schema の最終締め / 現場差し替え手順
- 0820 の packaged 600秒 idle（本番 shell の 120秒とは別）
- 遠隔 content 同期
