# Production runtime spec（現場固定メモ）

production app（`TRUNK_DEMO=production`）の現場仕様。UI 再デザイン・content 差し替え・Phase 8 packaging は対象外。

矛盾時は **この文書 + 実装** を優先する。ルート `README.md` の `TOP` / 10 分 idle は歴史的な function.xlsx 記述であり、production shell の現場運用には使わない。

関連:

- 起動前: [`phase7-site-preflight.md`](./phase7-site-preflight.md)
- 起動後 QA: [`phase7-site-qa-checklist.md`](./phase7-site-qa-checklist.md)

---

## 現場で使う起動コマンド

すべて `app/` で実行する。リポジトリ直下の `.bat` は同じコマンドをダブルクリック用に包んでいる。

| # | コマンド | 用途 | 現場 4 面の正か |
|---|----------|------|-----------------|
| 1 | `npm run start:production` | 本番想定。4 BrowserWindow。**AD_IDLE 開始**。4 面同期確認。現場プレ実機検証のメイン | **正** |
| 2 | `npm run start:production:preview` | 1 画面で UI 確認。**PRODUCT_LIST 直行**（AD_IDLE / ANIMATION をスキップ）。デザイン微修正 | **使わない** |
| 3 | `npm run start:production:preview:multi` | 4 window 挙動確認。AD_IDLE 開始。本番に近いが preview 扱い。開発 PC で 4 window の状態確認 | **代替にしない** |
| 4 | `npm run check:production-content` | `content/` の list / food / cover / text / animation / Logo / fonts 等を確認 | 起動前 |
| 5 | `npm run build` と `npm run build:production` | TypeScript（Electron main）と production renderer の build 確認 | 起動前 |

Windows 現場:

| bat（リポジトリ直下） | 中身 |
|----------------------|------|
| `launch-production.bat` | `app` へ移動 → `npm run start:production` → `pause` |
| `launch-production-preview.bat` | `app` へ移動 → `npm run start:production:preview` → `pause` |
| `check-production-content.bat` | `app` へ移動 → `npm run check:production-content` → `pause` |
| `build-production.bat` | `app` へ移動 → `npm run build` → `npm run build:production` → `pause` |

**本番確認は `npm run start:production`（または `launch-production.bat`）だけ。** preview を現場 4 面の合格判定に使わない。

---

## 4 画面 + 管理画面の規定ルール

**管理画面は 5 枚目の production window ではない。** 管理画面用に 5 つ目の BrowserWindow を出さない。

| ディスプレイ | 役割 | production window | `monitor-layout.json` |
|--------------|------|-------------------|------------------------|
| 4 画面タッチモニター | 来場者向けコンテンツ | **配置対象（4 枚だけ）** | **含める（monitorId 1..4）** |
| 管理画面 | Windows 操作、PowerShell / Cursor / Explorer、Debug 確認、ログ確認、タスクマネージャー | **配置しない** | **含めない** |

Windows の「ディスプレイ設定」では管理画面を含めた **全ディスプレイが見える**。ただし app 側が出す **content window は 4 枚だけ**。

- 管理画面の解像度・座標は、大画面レイアウト計算に含めない
- 一致時、余った OS ディスプレイは `management display excluded` としてログに出す（window は作らない）
- 4 面の順番は実機の物理配置と `monitorId` 1→2→3→4 が一致していること

---

## Global scene（4 面同期）

`globalScene` は 4 monitor で同じ値。

| 値 | 意味 |
|----|------|
| `AD_IDLE` | 起動初期。広告ループ。どの面を touch しても 4 面とも ANIMATION へ |
| `ANIMATION` | 入場 mp4。**touch skip なし**。終了後 4 面とも PRODUCT_LIST |
| `PRODUCT_LIST` | LIST。各面の操作は独立 |

同期対象:

- `AD_IDLE`
- `ANIMATION`
- `PRODUCT_LIST` 入場
- **120 秒 Non-Touch による AD_IDLE 復帰**（4 面全体で 1 本のタイマー）

---

## Local overlay（1 面だけ）

`localOverlay` は monitor ごと。`globalScene` に上げない。

| 値 | 意味 |
|----|------|
| `NONE` | overlay なし。LIST 操作可能 |
| `IMAGE_ZOOM` | その面だけの画像拡大 |
| `CATEGORY_DRAWER` | その面だけの hamburger ドロワー |
| `CATEGORY_MODAL` | その面だけのカテゴリ modal（Food 等） |

独立対象（他 monitor に伝播しない）:

- IMAGE_ZOOM / CategoryDrawer / Category modal
- LIST 操作（pan / dolly / bubble）
- selected image
- gesture / camera state

---

## 重要ルール

1. IMAGE_ZOOM / Drawer / modal は **globalScene に上げない**
2. 1 monitor の overlay は **他 monitor に影響しない**
3. overlay 中の lock は **owning monitor のみ**
4. 他 monitor の LIST 操作は **継続可能**
5. **AD_IDLE 復帰時のみ**、全 monitor の overlay / gesture / selected / camera / bubble をリセット
6. **ANIMATION 中 touch skip なし**（touch は無視してログ `animation touch ignored`）
7. **120 秒 Non-Touch は 4 面全体判定**。1 面でも有効操作があれば戻らない
8. **Bubble 追従だけでは idle をリセットしない**
   - LIST 上で pointer が無い hover 追従、または接触なしの見た目追従は idle 対象外
   - 指を置いた（`pointerdown`）、pan / pinch / wheel、overlay 上の継続 touch は idle をリセットする
   - overlay 中の `pointermove` は 400ms スロットルで activity 報告

Idle は PRODUCT_LIST のときだけ armed。AD_IDLE / ANIMATION ではオフ。Debug topbar 例: `idle: 118.2s / 120s` または `idle: off (120s …)`。パネルキー名は `idle.armed` / `timeout=`（`idleRemaining` というフィールド名は無い）。

---

## monitor-layout

必須ファイル: `content/monitor-layout.json`

| JSON キー | 意味 |
|-----------|------|
| `monitorId` | 1..4。物理並びと一致させる |
| `x` / `y` / `width` / `height` | そのモニターの OS bounds（論理ピクセル） |
| `orientation` | 現場は `portrait`（現行 1080×1920） |
| `viewportOffsetX` / `viewportOffsetY` | 仮想デスクトップ上のオフセット（現行は各面の `x` / `y` と同じ） |
| `scale` | レイアウト scale（現行 `1`）。Windows の拡大縮小率そのものではない |
| `boundsTolerancePx` | OS bounds との許容差（現行 **8**） |
| `fatalOnBoundsMismatch` | Phase 7 現場プレ検証は **`false`**（warning で起動） |

OS 側で別途確認するもの:

- ディスプレイの **拡大縮小率**（Windows 設定）。JSON に `scaleFactor` キーは無い
- Debug の `devicePixelRatio` / `layout.scale`

確認手順の詳細は [`phase7-site-preflight.md`](./phase7-site-preflight.md)。

### bounds mismatch

| 状況 | 挙動（`fatalOnBoundsMismatch: false`） |
|------|----------------------------------------|
| 4 面が tolerance 内で一致 | その 4 面に window。余りは管理画面として除外 |
| 4 面あるが座標・サイズが合わない | OS の x,y 順で 4 面に 1:1 配置。`BOUNDS MISMATCH`。**5 枚目は出さない** |
| 4 面未満 | primary 上に 4 window を 2×2 タイル（**dev fallback**）。会場サインオフ不可 |
| `fatalOnBoundsMismatch: true` かつ不一致 | 起動をやめる（本番 fix 後に検討） |

Phase 7 推奨:

- まず **warning 扱いで起動できる**こと
- 差分が大きい場合は `monitor-layout.json` を直す
- 現場の目安は **±5px** 程度。JSON の数値許容は `boundsTolerancePx`（現行 8px）
- 会場 bounds が確定してから fatal 運用を検討

---

## content 構成（現場で見るもの）

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

Phase 7 で確認すること:

- list 画像が出る（`content/images/list/`）
- Food carousel が意図通り（`images/food/` + `categories.json`）
- cover / コース表紙が意図通り（`images/cover/`）
- text が IMAGE_ZOOM / Category modal に出る（`content/text/`、現行 `TOKYO FOOD.txt`）
- animation mp4 が再生される（現行 `content/animation/LogoMotion_Trunk.mp4`。mp4 があるとき runtime は `media-ended` 待ち）
- Logo が出る（`content/Logo/`）
- MaisonNeue 等の font がある場合は読み込まれる（`content/fonts/`）

---

## Debug / 管理画面で見る情報

既定は **review**（topbar / debug 非表示、frameless）。管理画面のキーボードで **production window にフォーカス**してから操作する。

| キー | 実装 |
|------|------|
| `D` または `G` | `debug` ↔ `review`（chrome: topbar + Show debug） |
| `P` | debug **パネル**の表示切替。先に `D`/`G` で debug にしてから |
| `R` | review に戻し、パネルを隠す |
| `1` / `2` / `3` | 強制 `AD_IDLE` / `ANIMATION` / `PRODUCT_LIST`（chrome なしでも効く。現場合格判定には使わない） |
| `Z` / `H` / `C` / `X` | overlay 開閉の開発用 |

手順: 対象 window をクリック → `D` → `P` または **Show debug**。

topbar: `monitor`、`globalScene`、`idle: Xs / 120s`、`fps`、`BOUNDS MISMATCH`、`DEV FALLBACK`、`PREVIEW`。

パネルで確認する項目:

| 項目 | パネル上の名前 |
|------|----------------|
| globalScene | `globalScene` |
| monitorId | `monitorId` |
| localOverlay | `localOverlay` |
| idle 残り | topbar `idle: …`。パネルは `idle.armed` / `timeout=` |
| listImageCount | `listImageCount` |
| listSourceMode | `listSourceMode` |
| categoryFoodFolderCount | `categoryFoodFolderCount` |
| categoryFoodSlideCount | `categoryFoodSlideCount` |
| coverImageCount | `coverImageCount` |
| textLoaded | `textLoaded` |
| textSource | `textSource` |
| animationVideoMode | `animationVideoMode` |
| animationVideoFiles | `animationVideoFiles` |
| fps | `fps`（LIST マウント時） |
| textureLoadedCount | `textureLoaded` |
| textureFailedCount | `failed` |
| bounds mismatch | topbar `BOUNDS MISMATCH` と `debug.boundsMismatch` |

管理画面では Electron 起動ログ、Windows タスクマネージャー（CPU / GPU / Memory）、必要なら DevTools も使う。**管理画面自体に production window を出して Debug する必要はない。**

---

## 今回やらないこと

- UI 再デザイン、content 内容変更
- Phase 8 packaging / installer / exe 化
- app 構造の大変更
- globalScene / localOverlay / overlay independence / 120 秒 Non-Touch 仕様の変更
