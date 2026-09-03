# Phase 7 現場プレ実機 — 起動後 QA checklist

`npm run start:production`（`launch-production.bat`）で実施する。preview 起動での合格は無効。

仕様: [`production-runtime-spec.md`](./production-runtime-spec.md)。起動前: [`phase7-site-preflight.md`](./phase7-site-preflight.md)。

**管理画面には production LIST/広告が出ないこと。** 余ったディスプレイに認識モニター一覧の管理コンソールが出る。Debug は管理 PC のキーボードで各 content window にフォーカスして `D` → `P`。

---

## 1. 起動

- [ ] **4 枚の content window** が出る
- [ ] **管理画面には production window が出ない**
- [ ] 余ったディスプレイに **管理コンソール**（OS ディスプレイ id / 役割 / bounds）が出る
- [ ] 4 window が正しいタッチモニターに配置される
- [ ] 起動初期は **AD_IDLE**
- [ ] AD_IDLE で `content/ads/` の mp4 が流れる（無ければプレースホルダ。touch は通る）
- [ ] topbar（`D`）に `PREVIEW` / `DEV FALLBACK` が **出ていない**（出ていたら本番コマンドではない、または 4 面未満）
- [ ] `BOUNDS MISMATCH` が出る場合、差分が小さく面の対応が正しいこと。大きければ layout 修正して再起動

---

## 2. AD_IDLE / ANIMATION

- [ ] 広告（どの画面でも）を touch すると **4 面とも ANIMATION** へ移行
- [ ] ANIMATION mp4 が流れる（`LogoMotion_Trunk.mp4`）
- [ ] ANIMATION 中 touch で **skip されない**（再生が続く）
- [ ] 終了後 **4 面とも PRODUCT_LIST** へ移行
- [ ] Debug: `adsVideoMode` / `adsVideoFiles` / `animationVideoMode` / `animationVideoFiles`

---

## 3. PRODUCT_LIST

- [ ] 4 面それぞれに LIST が出る
- [ ] list 画像が本番 content 由来（`listSourceMode` / `listImageCount`）
- [ ] pan / dolly / bubble が動く
- [ ] **1 面の操作が他面に影響しない**（カメラ・選択・bubble）
- [ ] `textureFailedCount` が異常に多くない
- [ ] fps が破綻しない（下記 performance）

---

## 4. IMAGE_ZOOM

- [ ] 画像 tap で **その面だけ** 開く
- [ ] text が表示される（`textLoaded` / `textSource`）
- [ ] close で戻る
- [ ] 他面は操作可能（LIST が止まらない）

---

## 5. CategoryDrawer

- [ ] hamburger で **その面だけ** 開く
- [ ] Food / Gift / Flower が選択できる
- [ ] 外 tap / close が自然
- [ ] 他面の LIST は継続

---

## 6. Category modal

- [ ] Food で modal が開く（その面だけ）
- [ ] cover / コース表紙 / 料理画像の順番が自然
- [ ] swipe / loop が動く
- [ ] **dots 非表示** が維持される
- [ ] description が縦スクロールできる
- [ ] scroll 中に背面 LIST が動かない
- [ ] close で戻る（再オープン時は先頭からでよい）
- [ ] Debug: `categoryFoodFolderCount` / `categoryFoodSlideCount` / `coverImageCount`

---

## 7. 120 秒 Non-Touch

- [ ] **4 面全体**で 120 秒無操作なら AD_IDLE へ戻る
- [ ] **1 面でも**操作していれば戻らない
- [ ] AD_IDLE 復帰時に **全 overlay** が閉じる（ZOOM / Drawer / modal）
- [ ] 復帰後の touch で再び 4 面 ANIMATION
- [ ] Bubble の見た目追従だけでは戻らない（指を置かない hover 相当）。指 down / pan はリセットされる
- [ ] topbar: `idle: …s / 120s`（PRODUCT_LIST 中のみ armed）

短縮確認が必要な開発時のみ `TRUNK_PRODUCTION_IDLE_SECONDS`。現場の合格は **120 秒**。

---

## 8. performance

- [ ] 4 window で FPS が破綻しない
- [ ] 管理画面のタスクマネージャーで CPU / GPU / Memory を確認
- [ ] **30 分以上**放置して落ちない
- [ ] 可能なら **60 分**放置確認
- [ ] 操作時に極端なカクつきがない
- [ ] Debug `fps`、必要なら `textureLoaded` / failed

---

## Debug の出し方（実装どおり）

既定は review（非表示）。

1. 確認したい production window をクリックしてフォーカス
2. **`D` または `G`** → topbar が出る（`debug` モード）
3. **`P`** または **Show debug** → パネル
4. 隠す: **`R`**、またはもう一度 `D`/`G`

見るもの: `globalScene`、`monitorId`、`localOverlay`、idle（topbar 残り秒）、`listImageCount`、`listSourceMode`、`categoryFoodFolderCount`、`categoryFoodSlideCount`、`coverImageCount`、`textLoaded`、`textSource`、`animationVideoMode`、`animationVideoFiles`、`fps`、`textureLoaded` / failed、`BOUNDS MISMATCH`。

詳細表は [`production-runtime-spec.md`](./production-runtime-spec.md) の Debug 節。

---

## Mayu 側が現場で確認すること（要約）

1. 本番コマンドで 4 window、管理画面に 5 枚目が無い
2. 面の順番と `monitor-layout.json` が実機と一致
3. AD_IDLE → ANIMATION（skip なし）→ LIST の 4 面同期
4. ZOOM / Drawer / modal は 1 面だけ、他面は触れる
5. Food の cover 順・dots なし・description scroll
6. 120 秒は 4 面共有。復帰で全 overlay リセット
7. 30–60 分落ちない、操作時の FPS

切り分けは [`phase7-site-preflight.md`](./phase7-site-preflight.md) の troubleshooting。
