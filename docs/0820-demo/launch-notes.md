# 8/20 demo Launch Notes

| 項目 | 内容 |
|------|------|
| デモ日 | 2026-08-20 |
| 対象 | `app/renderer/demo-0820`（`TRUNK_DEMO=0820`） |
| 作成日 | 2026-08-19 |
| Phase | 8 |
| 機械可読 | [`launch-notes.json`](./launch-notes.json) |
| 当日チェック | [`final-smoke-test.md`](./final-smoke-test.md) |
| カラー複製 | `app/renderer/demo-0820-color`（`npm run start:0820-color` / `launch-0820-color.bat`）。白黒なし。本体はこの Launch Notes のまま |

---

## 1. デモの位置づけ

8/20 は **本番完成版ではない**。55インチ縦タッチ **1 枚** で体験合意するためのデモです。

見せる主役:

- PRODUCT_LIST（Three 空間）
- Bubble Color Reveal
- 画像 tap → IMAGE_ZOOM → close → LIST
- CategoryDrawer
- Category select → PRODUCT_DETAIL **placeholder** → close → LIST
- 2本指 pinch / Shift+scroll の Dolly Cruise

対象外:

- 4面同期
- PRODUCT_DETAIL 本実装（商品データ・カルーセル）
- exe 化
- Vercel 公開
- 管理モニター本番仕様
- CategoryDrawer 再デザイン
- LIST_demo / DF / DE / DD / DB / DA の変更

---

## 2. 起動手順

55インチ縦モニターを接続し、Windows で **縦向き** にしてから起動する。

```powershell
cd app
npm run start:0820
```

このコマンドが行うこと:

1. `renderer/demo-0820` をビルド（`dist/index.html`）
2. `TRUNK_DEMO=0820` / `TRUNK_MONITOR_COUNT=1`
3. idle は未設定なら **600 秒**（10 分）
4. Electron を 1 window で起動

### 起動前

- 古い Electron が残っていたら終了する（タスクマネージャー、または PowerShell）:

```powershell
Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force
```

- Debug HUD で `phase: 8` を確認。古い Phase なら再ビルドできていない。
- 縦置きで高さが十分あるディスプレイでは、窓はワークエリア全面になる。開発用横長 PC では 540×960 になる。

### 見せ方

- **来場者には Review Mode**（既定。HUD / DemoToggles 非表示、Bubble は見える）
- **調整するときだけ Debug Mode**（`G` または `D`）
- 見せる前に必ず `R` で Review に戻す

### 別 PC へ持っていくとき

exe 化は 8/20 対象外。詳細とチェックリスト: [`transfer-test.md`](./transfer-test.md)。

1. `TRUNK_delivery/` を **フォルダごと** コピーする（`git clone` だけだと `content/images` が抜けて 70 枚にならない）
2. 先方で Node.js **22.12+**
3. `setup-0820.bat`（`app` と `renderer/demo-0820` の両方で `npm ci`）
4. `launch-0820.bat`（`cd app` → `npm run start:0820`）

- contentRoot は元 PC の絶対パスに固定されていない。cwd=`app/` の親の `content/`
- `TRUNK_CONTENT_ROOT` が元 PC パスのままだと画像が出ない。通常は未設定
- 画像は `trunk-content://`（Electron 内プロトコル。別 Windows でも同じ起動なら動く）

---

## 3. 当日最初に確認する項目

起動後、Review の前に Debug で一度通す。

- [ ] TOP が表示される
- [ ] TOP tap → ANIMATION（placeholder。裏で LIST 準備）
- [ ] ANIMATION → PRODUCT_LIST（画像が載った状態で出る）
- [ ] canvas count = 1
- [ ] displayedImageCount = 70
- [ ] textureLoadedCount = 70
- [ ] FPS が大きく落ちていない（目安 55〜60）
- [ ] Bubble が表示される
- [ ] Bubble 内だけカラー復帰する
- [ ] 1本指 drag できる
- [ ] 2本指 pinch で Dolly Cruise が動く
- [ ] tap → IMAGE_ZOOM
- [ ] IMAGE_ZOOM close → PRODUCT_LIST
- [ ] hamburger → CategoryDrawer
- [ ] CategoryDrawer close
- [ ] Category select → PRODUCT_DETAIL placeholder
- [ ] PRODUCT_DETAIL close → PRODUCT_LIST
- [ ] Review Mode で Debug UI が消える

詳細は [`final-smoke-test.md`](./final-smoke-test.md)。

---

## 4. 操作説明

### 来場者向け

- 画像空間を触って探索する（1本指 drag = パン）
- 画像を短く tap すると拡大表示（IMAGE_ZOOM）
- × で LIST に戻る
- 右辺中央の hamburger で CategoryDrawer
- Food / Gift / Flower を選ぶと DETAIL 風の白画面
- 2本指 pinch in / out で奥行き方向に移動（余韻あり）

### 開発者 / オペレーター

| キー | 動作 |
|------|------|
| `G` / `D` | Debug ⇔ Review 切替 |
| `R` | Review に固定 |

- Debug 時のみ右下 **DemoToggles**
- HUD は Debug のみ（左上 content / 右上 rest）
- 入力欄にフォーカス中はショートカット無効

---

## 5. DemoToggles 項目

Debug 右下。Review では消える。

| 項目 | 効く対象 | 当日触るとき | 注意 |
|------|----------|--------------|------|
| visual preset | カードの暖色ティント / フォグ | 色が強すぎ / 弱すぎ | 空間の印象が変わる。来場前に戻す |
| bubble motion | elegant = 呼吸+glint / off = 静的円 | FPS が落ちる、または動きが目立つ | off でもカラー復帰は残る |
| ui mode | review / debug | 見せる前は review | debug のまま出さない |
| pixel ratio cap | GPU 描画解像度上限（1 / 1.5 / 2） | FPS が 50 を切って続く | 下げると少しぼやける。当日第一手 |
| bubble size | Bubble 円の CSS px | 55インチで小さい / 大きい | **160** / 240 / 320 / 400 / 480。初期 **320** |
| reveal radius | カラー復帰半径 CSS px | Bubble に対して色円が合わない | 120 / 160 / 200 / 260。初期 **160**。size より小さくてよい |
| list speed | カードのドリフト＋idle 浮遊 | 空間が静か / せわしい | カメラ操作は変わらない |
| dolly cruise | Shift+wheel / pinch の慣性ドリー on/off | 比較確認のみ | off にすると pinch のヌルヌルが消える。見せるときは **on** |
| dolly feel | speed / smoothing / pinch をセット | ピンチの強さを一発で変えたい | conservative / default / deep / punchy。55インチは **deep から** 試す |
| dolly speed | 奥行き入力の初速倍率 | 1回の pinch で進みすぎ / 足りない | Shift+wheel と pinch と通常 wheel 全部に掛かる |
| dolly smoothing | クルーズ中、カメラが目標に追いつく速さ | 遅れて付いてくる / 食いつきが硬い | **大きいほど追従が速い**。余韻の長さではない |
| pinch sensitivity | pinch だけ追加倍率 | 指の開閉量に対して弱い / 強い | wheel には効かない。dolly speed の後に掛かる |

### 丁寧に扱う 5 項目

**dolly speed**  
同じ pinch / Shift+scroll で「どれだけ潜るか」。上げると初速が上がる。余韻そのものは `releaseBrake`（コード定数、トグル無し）。

**dolly smoothing**  
「ヌルヌル」の本体ではない。目標 Z への食いつき。上げすぎると硬く、下げすぎると遅れて付く。

**pinch sensitivity**  
WinTouch の 2本指だけ。55インチは指の移動が大きいので default が弱く感じたら 1.6（deep）へ。

**bubble size / reveal radius**  
55インチで円が小さく見えることがある。size を 400〜480、radius は size の半分前後が無難。初期値 320 / 160 はコード上の既定（勝手に恒久変更しない）。

**pixel ratio cap**  
FPS 低下の第一手。2.0 → 1.5 → 1.0。Review Mode にして HUD を消すのも同時に試す。

---

## 6. 既知問題

| 内容 | 扱い |
|------|------|
| PRODUCT_DETAIL は白 placeholder（カテゴリ名 + ×） | 仕様。本実装しない |
| CategoryDrawer は Frozen 優先。55インチで item が小さく感じる可能性 | 見た目値は当日勝手に変えない |
| hamburger 52px が実機で小さく感じる可能性 | 同上。位置は右辺・縦中央 |
| drawer 幅は Frozen 320px ではなく `100vw / 3`（承認済み差分） | これ以上広げない |
| ワールドサイズは 55インチで再評価対象。開発窓では小さく見える | cardLongSide 280 等は当日大規模変更しない |
| `content/images/list` 直下は **0 枚**。`recursive-images`（25 source）を 70 カードに複製 | Debug の exploreSource を見る |
| 画像素材は仮 / 現素材流用 | 欠けるより複製を優先 |
| Debug UI は顧客に見せない | Review（`R`）で見せる |
| Electron CSP `unsafe-eval` warning | 既知。開発起動のみ。デモ動作には無関係 |
| Parsec 越しはカクついて見えることがある | 最終体感は現地 PC / 現地モニター |
| 通常 wheel と Shift+wheel は別物 | 来場者操作は pinch。wheel は開発用 |
| ANIMATION は仮 placeholder。裏で LIST を準備し、画像 ready まで LIST を出さない | 2 秒より少し延びることがある |
| 無操作 10 分で TOP に戻る（0820 起動時 600s）。TOP に戻ると LIST は破棄され、次は ANIMATION から再準備 | 2 周目は初回と同じ待ち |
| キオスク exe 化は未実施 | 当日は `npm run start:0820` |

---

## 7. トラブル対応

### 画面が古い Phase に見える

1. Electron を全部終了
2. `cd app` → `npm run start:0820`（ビルド込み）
3. Debug で `phase: 8`
4. まだ古いなら `app/renderer/demo-0820/dist` が更新されているか確認

### FPS が低い

1. `R` で Review（HUD オフ）
2. pixel ratio cap **1.5**、だめなら **1.0**
3. bubble motion **off**
4. 他ブラウザ / Parsec / 監視ウィンドウの負荷を落とす
5. 継続して 40fps 以下なら GPU / ケーブル / 解像度を確認

### 画像が出ない

1. 起動ログの `contentRoot=` がリポジトリの `content` を指しているか
2. `content/images` に food / gift / flower 等があるか
3. Debug: `contentLoadStatus` / `realImageCount` / `textureLoadedCount` / `first image URL scheme`（`trunk-content` であること）
4. `TRUNK_CONTENT_ROOT` の誤設定がないか
5. 全部失敗なら fallback カード。起動そのものは落ちない

### tap できない

1. IMAGE_ZOOM / drawer / PRODUCT_DETAIL が開いていないか（開いていると LIST 操作は止まる）
2. Debug: `Explore interaction enabled` が true か
3. `pinchActive` / `isPinching` が残っていないか（指を全部離す）
4. 短く tap。大きく動かすと drag 扱い（閾値 16px / 600ms）

### Bubble が出ない

1. `screenState` が PRODUCT_LIST か
2. drawer / ZOOM / DETAIL 中でないか
3. Debug: `bubbleAllowed` / `bubbleEnabled`
4. Review でも Bubble 自体は見える。HUD が無いだけで演出は動く

### pinch で画面ごと拡大される

ページの視覚ズームは起動時に 1 固定している。まだ拡大するなら Electron を再起動。OS 側の拡大は Windows 表示スケールを確認。

### pinch が弱い / 強すぎる

Debug → dolly feel **deep** または pinch sensitivity 1.6。見せる前に `R`。

### ANIMATION から進まない

裏の画像読み込み待ち。最大約 12 秒。それ以上ならログの texture 失敗を確認し再起動。

### Context Lost / 真っ黒

ログに `WebGL context lost`。アプリ再起動。他の重い GPU アプリを閉じる。

---

## 8. 世界・UI の現在値（当日は大規模変更しない）

| 項目 | 値 |
|------|-----|
| cardLongSide | 280 |
| card scale | 0.72 … 1.28 |
| sceneSpread | x 4400 / y 2800 / z 6800 |
| cameraFov | 52 |
| initialCameraZ | 1800 |
| Z wrap | 80 … 6400 |
| hamburger | 52px、右 14px、縦中央 |
| drawer 幅 | `100vw / 3` |
| Bubble 初期 | 320 / reveal 160 |
| Dolly 初期 | speed 1.0 / smoothing 0.20 / pinch 1.0 / cruise on |

55インチでカードが明らかに小さい場合の候補（**報告してから**）: cardLongSide を 320〜360。spread / fov は触らない方が安全。

---

## 9. 必須導線（1本）

```text
TOP
  → ANIMATION
  → PRODUCT_LIST
  → 画像 tap → IMAGE_ZOOM → × → PRODUCT_LIST
  → hamburger → CategoryDrawer → 閉じる
  → hamburger → Food / Gift / Flower
  → PRODUCT_DETAIL placeholder → × → PRODUCT_LIST
```

pinch と Bubble はこの LIST 上で確認する。ZOOM / drawer / DETAIL 中は LIST も Bubble も止まる。

---

## 10. Phase 8 開発 PC Smoke（2026-08-19）

ソフトウェア導線は開発 PC で通過（524×895 / DPR 1 / phase 8）。

- TOP → ANIMATION → LIST → ZOOM → LIST → Drawer → Food/Gift/Flower DETAIL → LIST
- Bubble / 合成 pinch の Dolly Cruise / Review で Debug UI 非表示
- displayedImageCount 70 / textureLoadedCount 70 / canvas 1
- FPS 52〜60、Context Lost なし、想定外 console error なし
- 既知: Electron CSP `unsafe-eval` warning

**55インチ縦 / WinTouch の最終体感は現地。** ピンチが弱ければ Debug で dolly feel **deep**。見せる前に `R`。
