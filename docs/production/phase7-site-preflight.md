# Phase 7 現場プレ実機 — 起動前 preflight

**クローン・モジュール入れ・起動・よくあるエラー**は [`引継ぎ手順書/README.md`](../../引継ぎ手順書/README.md) を先に使う。このファイルは Windows 4 面配置と content 確認用。

会場で起動する前の確認。仕様の正は [`production-runtime-spec.md`](./production-runtime-spec.md)。起動後は [`phase7-site-qa-checklist.md`](./phase7-site-qa-checklist.md)。

**合格の前提:** 本番確認は `npm run start:production:site`（または `launch-production-site.bat`）。JSON サイズで窓を合わせる旧 `launch-production.bat` は使わない。frameless + `display.bounds` + `setFullScreen(true)`。管理画面は 5 枚目の production window ではない。

---

## Windows 側

- [ ] 4 画面タッチモニターが認識されている
- [ ] 管理画面が **別ディスプレイ** として認識されている
- [ ] Windows 表示設定で並び順が把握できている（1→2→3→4 の物理順）
- [ ] 拡大縮小率が想定どおり（現場は通常 100%。JSON の `scale` とは別）
- [ ] タッチ入力の割り当てが正しい（触った面だけ反応する）
- [ ] 電源設定でスリープしない
- [ ] スクリーンセーバー OFF
- [ ] 通知を抑制
- [ ] 音は今回無視、または現場調整

確認場所: 設定 → システム → ディスプレイ。識別番号と物理位置を紙または写真に残す。

---

## GitHub クローン（現場）

`feature/production-phase7` には `LIST_demo` を含めない。履歴ごと取ると重いので、会場は浅い single-branch クローンにする。

```powershell
git clone --single-branch --depth 1 -b feature/production-phase7 https://github.com/mayu1080/TRUNK-Web.git
```

その後 USB の `content/`（images / fonts / Logo / text / mp4）をリポジトリ直下に載せる。

## app 側

作業ディレクトリは `app/`。リポジトリ直下の bat でも可。

- [ ] `content/` フォルダが存在する（開発時はリポジトリ直下）
- [ ] `npm run check:production-content` が通る（`check-production-content.bat`）
- [ ] `npm run build` と `npm run build:production` が通る（`build-production.bat`）
- [ ] `content/monitor-layout.json` が現場構成に合っている（下の手順）
- [ ] `npm run start:production:site` で起動できる（`launch-production-site.bat`）＝**現場の正**
- [ ] preview 用の環境変数が残っていないこと（`start:production` は site と同じスクリプト）

どちらも PowerShell に残った `TRUNK_PRODUCTION_PREVIEW_*` を消し、`TRUNK_PRODUCTION_FORCE_NO_PREVIEW=1` を立ててから起動する。現場 4 面で preview scale を使わない。

任意: `npm run check:production-phase7`（4 面物理なしでも layout / overlay 契約を確認）、`npm run check:production-phase71`（LIST independent world / fullscreen log / ads split 契約）。

Node.js 22.12+、初回は `cd app` → `npm ci`、`npm --prefix renderer/production ci`。

---

## monitor-layout 確認手順

ファイル: `content/monitor-layout.json`

1. エントリが **4 件だけ**（monitorId 1..4）。管理画面の行が無いこと
2. 各行を Windows 表示設定の bounds と突き合わせる

確認項目:

| 項目 | 見る場所 |
|------|----------|
| `monitorId` | JSON。物理の左→右（または現場の番号）と一致させる |
| display bounds | Windows ディスプレイ設定の配置 |
| `x` / `y` | 仮想デスクトップ上の原点 |
| `width` / `height` | 現行想定 1080×1920 portrait |
| 拡大縮小 / scaleFactor | Windows 設定。JSON キーは `scale`（現行 1）。Debug の `devicePixelRatio` |
| `viewportOffsetX` / `viewportOffsetY` | 現行は各面の `x` / `y` と同じ。**LIST の見え方には影響しない**（Phase 7.1 で LIST は使わなくなった） |
| 管理画面が含まれていないこと | JSON に 5 件目が無い。起動ログに `management display excluded` |
| 4 画面の順番が実機配置と一致 | monitor 1 が意図した端の面か |

### bounds mismatch

起動後 topbar（`D` で debug）の **BOUNDS MISMATCH**、または起動ログの `bounds mismatch monitorId=`。

| 差分 | Phase 7 の扱い |
|------|----------------|
| 目安 ±5px 以内、または `boundsTolerancePx`（現行 8）以内 | 起動してよい。ログに matched と出る |
| 数 px〜数十 px で面の対応は正しい | warning で起動可。あとで JSON を直す |
| 面の順番が違う / 解像度が違う / 管理画面に window が乗る | **JSON を直してから再起動** |
| ディスプレイが 4 未満 | 2×2 **dev fallback**。現場プレ検証の合格にしない |

`fatalOnBoundsMismatch` は現場プレでは **false**。本番 fix 後に fatal を検討。

---

## content 確認手順

```text
content/
  images/
    list/
    food/
    gift/
    flower/
    cover/
  text/
  animation/
  Logo/
  fonts/
  monitor-layout.json
  categories.json
  ads.json
  animation.json
```

コマンド: `cd app` → `npm run check:production-content`

Phase 7 で中身を目視すること:

- [ ] `images/list/` に LIST 用画像がある
- [ ] `images/food/` と cover で Food carousel が組める
- [ ] `images/cover/` にコース表紙がある
- [ ] `text/`（現行 `TOKYO FOOD.txt`）がある
- [ ] `animation/LogoMotion_Trunk.mp4` がある
- [ ] `Logo/` にロゴがある
- [ ] `fonts/` に MaisonNeue 等がある場合、ファイルが読める

check が warning でも起動はできることがある。LIST が空・mp4 欠落は QA で落とす。

---

## Phase 7.1 で変わったところ（現場検証の反映）

### LIST: 1 monitor = 1 独立 world

- production 既定は **`listWorldMode: independent`**。4 面で 1 世界を分割表示しない
- `monitor-layout.json` は **BrowserWindow の配置だけ**に使う。LIST 内部の `viewportOffset` / camera offset は使わない
- **seed が monitor ごとに違う**（1234 + monitorId × 10001 → 11235 / 21236 / 31237 / 41238）。画像の抽出順と配置座標が面ごとに変わる
- 1 起動中は固定。AD_IDLE 復帰でも同じ配置に戻る
- **world 倍率の初期値は 4**（world ≒ 可視範囲 × 4）
- **上下左右すべて wrap**。端で止まらない / 跳ね返らない / 空白にならない
- 旧 4 面 1 世界は `sharedWall` feature flag として残置（現場では使わない）

### Fullscreen

- 現場正コマンドは `start:production:site`。`start:production` は同じ site スクリプトの別名
- window bounds は `workArea` ではなく **`display.bounds`**
- frameless（`frame: false`）＋ `setFullScreen(true)`。kiosk は未使用（`isKiosk` は false）
- 管理画面は production window の対象外（leftover display に管理窓）

### Ads

- 4320×1920 素材は **アプリ内で crop しない**。素材側で 4 分割して保存
- `content/ads/monitor-1.mp4` 〜 `monitor-4.mp4`
- 4 本そろえば `split`（monitorId 別再生）／1 本なら `single-shared`（4 面共通）／2〜3 本なら `per-monitor`（ある面だけ再生、欠落面は placeholder、warning）／0 本は `missing`（placeholder、warning）
- AD_IDLE の再生開始は 4 面同期

---

## Phase 7 現場再確認項目

`start:production:site` で起動 → `D` で Debug を出して確認する。詳細手順は [`phase7-site-qa-checklist.md`](./phase7-site-qa-checklist.md)。

| # | 確認 | 見る場所 |
|---|------|----------|
| 1 | `start:production:site` で 4 面すべてフル画面になる | 実機 / 起動ログ `isFullScreen: true` `isFrameless: true` `isKiosk: false` |
| 2 | 管理画面に production window が出ない | 実機 / ログ `management display excluded` |
| 3 | Debug の `listWorldMode` が `independent` | Debug パネル |
| 4 | `seed` が 4 面で違う | Debug の `seed`（11235 / 21236 / 31237 / 41238） |
| 5 | world が viewport の約 4 倍 | Debug の `world` と `mult 4x4`、`viewport` 行 |
| 6 | 4 面の LIST が同じ並びではない | 実機を並べて目視 |
| 7 | 右端のはみ出しが消えた | 実機。Debug の `css` / `drawingBuffer` / `camera.aspect` が window と一致 |
| 8 | 上下左右どの端でも止まらず wrap する | 実機で 4 方向 pan。Debug の `panWrap: x= y=` が増える。`panHardClamp: false` |
| 9 | 端で空白が出ない | 端を跨いで pan し続けてカードが途切れないこと |
| 10 | pan / dolly / bubble が面ごとに独立 | 1 面だけ操作して他 3 面が動かないこと |
| 11 | Image_ZOOM が壊れていない | カード tap → 拡大 → 閉じる。他面は LIST のまま |
| 12 | CategoryDrawer が壊れていない | ハンバーガー → Explore / Category 一覧 |
| 13 | Category modal が壊れていない | Drawer → カテゴリ → 白カード gallery、flick |
| 14 | AD_IDLE で monitor 別 mp4 が再生される | Debug の `adsVideoMode: split` / `adsVideoFile: ads/monitor-N.mp4` / `adsVideoReadyState` |
| 15 | 120 秒 Non-Touch が壊れていない | 4 面無操作で AD_IDLE へ戻る（判定は 4 面全体） |

---

## トラブル時の切り分け

### 4 window が出ない

1. `npm run start:production:site` か確認（`start:production:preview` は 1 window）
2. `start:production:preview:multi` は preview 配置。現場の正ではない
3. Windows でディスプレイが 4 面見えているか
4. `content/monitor-layout.json` が読めるか（無いと production は起動失敗）
5. 起動ログの `quitReason` / `no OS displays`

### window 位置がずれる

1. Windows 表示設定の並び・原点
2. 実機 bounds と JSON の `x,y,width,height`
3. 拡大縮小率（100% 以外だと論理サイズが変わる）
4. ±5px 程度か、大きなズレか。大きければ JSON 修正
5. `DEV FALLBACK` が出ていたら 4 面未満のタイル配置

### 管理画面に production window が出る

1. JSON に管理画面の bounds が入っていないか（5 件目を削除）
2. 4 面未満で fallback していると、primary（管理画面になりうる）に 4 枚タイルされる
3. 4 面ある不一致時は OS x,y 順の先頭 4 面。管理画面が座標的に先頭だとそこに乗る → JSON を実機 bounds に合わせて **一致**させる
4. 対象 4 画面の bounds を JSON に明示し、管理画面は leftover にする

### ANIMATION が流れない

1. `content/animation/LogoMotion_Trunk.mp4` の存在
2. `content/animation.json` の tracks / `skipOnTouch: false`
3. Debug の `animationVideoMode` / `animationVideoFiles`
4. 起動ログの missing / placeholder / video error
5. mp4 があるとき runtime は json の 5000ms ではなく **media ended** 待ち

### LIST 画像が出ない

1. `content/images/list/`
2. `npm run check:production-content`
3. Debug の `listImageCount` / `listSourceMode` / `textureFailedCount`
4. ファイル名の非対応拡張子

`content/images/list/` に画像があればそれが最優先。空のときだけ `content/images/` の再帰スキャン（`listSourceMode: recursive-images`）に落ちる。

### 4 面の LIST が同じ並びに見える

1. Debug の `listWorldMode` が `independent` か（`sharedWall` なら旧方式）
2. Debug の `seed` が 4 面で違うか
3. 同じなら `monitorId` が重複していないか（`monitor-layout.json`）

### LIST の端で止まる / 空白が出る

1. Debug の `panHardClamp` が `false` か（`true` なら sharedWall）
2. 端を越えるとき `panWrap: x= y=` が増えるか
3. `world` が `viewport` の 2 倍未満になっていないか（倍率下限は 2）

### 広告が 4 面同じ映像になる / 一部だけ流れる

1. `content/ads/monitor-1.mp4` 〜 `monitor-4.mp4` が 4 本あるか
2. Debug の `adsVideoMode`（`single-shared` なら 1 本、`per-monitor` なら 2〜3 本の不完全セット）
3. `content/ads.json` の `tracks` が monitorId 1..4 を張っているか
4. 起動ログの `ads missing N/4 files`（欠落面は先頭ファイルで埋めず placeholder）

### text が出ない

1. `content/text/TOKYO FOOD.txt`
2. Debug の `textLoaded` / `textSource`
3. 文字コード（UTF-8）

### font が出ない

1. `content/fonts/`
2. Debug の `fontLoaded` / `fontFallback` / `fontCheck`（`document.fonts.check()` 相当）
3. fallback フォントで出ているだけか、完全欠落か

---

## 現場最小手順（ここだけやれば起動できる）

1. 本 preflight の Windows 側をチェック
2. `check-production-content.bat`
3. 必要なら `build-production.bat`
4. `launch-production-site.bat`（=`npm run start:production:site`）
5. [`phase7-site-qa-checklist.md`](./phase7-site-qa-checklist.md) と上の「Phase 7 現場再確認項目」を実施
