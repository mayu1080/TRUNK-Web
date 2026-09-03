# 8/20 別 Windows Transfer Test

| 項目 | 内容 |
|------|------|
| 目的 | 別 Windows PC に `TRUNK_delivery/` 一式を渡し、`npm ci` 後に `npm run start:0820` で起動できるか確認する |
| デモ日 | 2026-08-20 |
| 対象外 | exe 化 / installer / 4面同期 / LIST_demo 変更 |
| 参照 | [`launch-notes.md`](./launch-notes.md) / [`final-smoke-test.md`](./final-smoke-test.md) |
| バッチ | リポジトリ直下 `setup-0820.bat` / `launch-0820.bat` |

---

## 1. 渡し方（重要）

**フォルダごとコピーする。`git clone` だけでは足りない。**

`.gitignore` により次は Git に入らない。

| パス | Git | Transfer で必要か |
|------|-----|-------------------|
| `content/images/**`（png 等） | 原則除外 | **必須。無いと 70 枚にならない** |
| `node_modules/` | 除外 | 不要。先方で `npm ci` |
| `app/**/dist/` | 除外 | 不要。`start:0820` がビルドする |
| `content/manifest.json` 等 | 含める | 必須 |

コピー後の先方フォルダ例:

```text
D:\demo\TRUNK_delivery\
  setup-0820.bat
  launch-0820.bat
  content\
    images\          ← 元PCの画像が入っていること
    manifest.json
  app\
    package.json
    package-lock.json
    renderer\demo-0820\
      package.json
      package-lock.json
```

USB / zip / 共有フォルダいずれも、**パスに日本語や極端に長い階層が無い**方が安全。

---

## 2. Node.js 推奨バージョン

| 区分 | バージョン |
|------|------------|
| **推奨** | **Node.js 22.12 以上**（22 LTS 可） |
| この開発 PC で確認済み | v24.15.0 / npm 11.12.1 |
| 不可 | Node 18 / Node 20（`electron@43` の `engines` が `>=22.12.0`） |

確認:

```powershell
node -v
npm -v
```

先方に Node が無い、または 22.12 未満なら [nodejs.org](https://nodejs.org/) から 22 LTS を入れる。インストール後は **新しい** コマンドプロンプトを開く。

`app/README.md` の「Node.js 20+」は古い記述。8/20 Transfer では **22.12+** を使う。

---

## 3. `npm ci` と `npm install`

**推奨は `npm ci`。** `setup-0820.bat` も `npm ci` を使う。

| | `npm ci` | `npm install` |
|--|----------|----------------|
| lockfile | **必須**（一致しないと失敗） | 無くても動くが lock を書き換えうる |
| 再現性 | 高い。元PCと同じ依存になりやすい | 低い |
| 用途 | Transfer / 当日セットアップ | lock が壊れたときの lag |

lockfile は両方ある。

- `app/package.json` + `app/package-lock.json`
- `app/renderer/demo-0820/package.json` + `app/renderer/demo-0820/package-lock.json`

`start:0820` は `renderer/demo-0820` を Vite ビルドするため、**app だけでなく demo-0820 でも `npm ci` が必要**。setup バッチは両方行う。

初回は Electron 本体のダウンロードでネットが必要。社内プロキシがある場合は npm が通るか先に確認する。

`npm ci` が lock 不一致で落ちたときだけ、そのディレクトリで `npm install` を試す。当日の通常手順にはしない。

---

## 4. contentRoot は元 PC の絶対パスに固定されていない

開発時の解決順（`app/electron/content/contentRoot.ts`）:

1. 環境変数 `TRUNK_CONTENT_ROOT`（**任意の上書き**。絶対パスになりうる）
2. パッケージ後: `{exeDir}/content`（8/20 では未使用）
3. 開発デフォルト: **`process.cwd()` の親の `content`**

`launch-0820.bat` / `npm run start:0820` は cwd を `app/` にする。よって:

```text
{コピー先}\TRUNK_delivery\content
```

を相対的に見つける。`C:\Users\m6101\...` のような元 PC パスはコードに入っていない。

起動ログで確認する:

```text
[content] contentRoot=...\TRUNK_delivery\content
[content] sampleUrl=trunk-content://local/images/...
```

`TRUNK_CONTENT_ROOT` が元 PC のパスのままだと画像が出ない。通常は **未設定**。`setup-0820.bat` / `launch-0820.bat` は値が入っていると警告し、この実行中だけ空にするか確認する（PC の環境変数は消さない）。

---

## 5. `trunk-content://` は別 Windows でも動く

- OS にカスタムプロトコルを登録する方式ではない
- **この Electron プロセス内**で `protocol.handle('trunk-content', ...)` する
- URL は `trunk-content://local/images/...`（相対パス）。ホスト PC 名は含まない
- 実ファイルは `contentRoot` 配下に解決してから読む

別 Windows でも、同じ Electron 起動なら動く前提。Renderer は `file://` 直読みしない。

---

## 6. 先方での手順

1. `TRUNK_delivery` を任意の場所へ置く（`content/images` 込み）
2. Node.js 22.12+ を入れる
3. `setup-0820.bat` を実行（失敗したら画面のメッセージで停止）
4. 55インチ縦なら接続して Windows を縦向きにする
5. `launch-0820.bat` を実行
6. 下の Transfer Smoke Test を実施
7. 来場者に見せる前に `R`（Review Mode）

手動でも可:

```powershell
cd app
npm ci
cd renderer\demo-0820
npm ci
cd ..\..
npm run start:0820
```

---

## 7. Transfer Smoke Test

実施日: ________  PC: ________  Node: ________  コピー先パス: ________

### セットアップ

- [ ] `TRUNK_delivery` 一式をコピーした（git clone だけではない）
- [ ] `content/images` に元 PC と同じ画像がある
- [ ] `node -v` が 22.12 以上
- [ ] `setup-0820.bat` が成功した（app と demo-0820 の両方）
- [ ] `TRUNK_CONTENT_ROOT` が未設定、またはこの PC の `content` を指している

### 起動

- [ ] `launch-0820.bat` または `cd app` → `npm run start:0820` で起動できる
- [ ] ログの `contentRoot=` が **この PC の** `...\TRUNK_delivery\content`
- [ ] ログの sampleUrl が `trunk-content://` で始まる
- [ ] `phase: 8`（Debug `G`）
- [ ] TOP が表示される

### LIST / 画像

- [ ] TOP tap → ANIMATION → PRODUCT_LIST が表示される
- [ ] content 画像が出る（単色 fallback だけではない）
- [ ] canvas count = 1
- [ ] displayedImageCount = 70
- [ ] textureLoadedCount = 70
- [ ] first image URL scheme = `trunk-content`

### 体験

- [ ] Bubble 内だけカラー復帰する
- [ ] tap → IMAGE_ZOOM
- [ ] IMAGE_ZOOM close → PRODUCT_LIST
- [ ] hamburger → CategoryDrawer
- [ ] Category select → PRODUCT_DETAIL
- [ ] PRODUCT_DETAIL close → PRODUCT_LIST
- [ ] Shift+wheel または 2本指 pinch で Dolly Cruise が動く
- [ ] `R` で Review Mode。Debug HUD / DemoToggles が消える

### 安定

- [ ] FPS が大きく落ちない
- [ ] Console に想定外の error がない（CSP `unsafe-eval` warning は既知）
- [ ] Context Lost なし

### 判定

- [ ] この PC でも 8/20 必須導線が通る
- **持ち込み可 / 保留**: ________

特記: ________

---

## 8. うまくいかないとき

| 症状 | 確認 |
|------|------|
| `npm ci` が Node バージョンで失敗 | 22.12 未満。入れ直してターミナルを開き直す |
| `npm ci` が lock 不一致 | コピー欠け。両方の `package-lock.json` があるか。最終手段だけ `npm install` |
| `demo renderer is not built` | `start:0820` を使う。demo-0820 の `npm ci` 漏れ |
| content エラーダイアログ | `content/` がリポジトリ直下にあるか。cwd が `app/` か |
| 画像 0 / fallback カード | `content/images` をコピーしたか。`TRUNK_CONTENT_ROOT` が元 PC パスではないか |
| `listImages=0` は正常 | recursive-images 25 → 表示 70。`sourceImageCount` を見る |
| 画面が古い Phase | 先方で `start:0820`（ビルド込み）。古い Electron を終了 |
| Electron が落ちる | GPU ドライバ / 他の Electron 残プロセス |

詳細な操作トラブルは [`launch-notes.md`](./launch-notes.md) の「トラブル対応」。
