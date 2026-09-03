# Phase 7 現場プレ実機 — 起動前 preflight

**クローン・モジュール入れ・起動・よくあるエラー**は [`引継ぎ手順書/README.md`](../../引継ぎ手順書/README.md) を先に使う。このファイルは Windows 4 面配置と content 確認用。

会場で `npm run start:production` する前の確認。仕様の正は [`production-runtime-spec.md`](./production-runtime-spec.md)。起動後は [`phase7-site-qa-checklist.md`](./phase7-site-qa-checklist.md)。

**合格の前提:** 本番確認は `npm run start:production`（または `launch-production.bat`）。管理画面は 5 枚目の production window ではない。

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
- [ ] `npm run start:production` で起動できる（`launch-production.bat`）

任意: `npm run check:production-phase7`（4 面物理なしでも layout / overlay 契約を確認）。

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
| `viewportOffsetX` / `viewportOffsetY` | 現行は各面の `x` / `y` と同じ |
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

## トラブル時の切り分け

### 4 window が出ない

1. `npm run start:production` か確認（`start:production:preview` は 1 window）
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
4. `launch-production.bat`（=`npm run start:production`）
5. [`phase7-site-qa-checklist.md`](./phase7-site-qa-checklist.md) を実施
