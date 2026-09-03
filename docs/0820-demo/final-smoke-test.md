# 8/20 最終 Smoke Test

| 項目 | 内容 |
|------|------|
| デモ日 | 2026-08-20 |
| 対象 | `npm run start:0820` |
| 参照 | [`launch-notes.md`](./launch-notes.md) |
| 実施場所 | 現地 55インチ縦 + WinTouch（最終判定） / 開発 PC は予備 |

起動:

```powershell
Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force
cd app
npm run start:0820
```

Debug 確認は `G`。来場者向け確認の前に `R`。

---

## A. 起動

- [ ] 起動できる
- [ ] Debug HUD の `phase` が **8**
- [ ] TOP が表示される
- [ ] 窓が 55インチ縦をだいたい埋めている（現地）

## B. 入場

- [ ] TOP tap → ANIMATION
- [ ] ANIMATION 中に空の LIST が一瞬出ない
- [ ] PRODUCT_LIST が表示される
- [ ] canvas count = 1
- [ ] displayedImageCount = 70
- [ ] textureLoadedCount = 70
- [ ] sourceImageCount が 0 でない（現状 25 + 複製が正常）

## C. LIST 体験

- [ ] Bubble が出る
- [ ] Bubble 内だけカラー復帰する
- [ ] 1本指 drag できる
- [ ] drag 中に誤って IMAGE_ZOOM に入らない
- [ ] 2本指 pinch できる
- [ ] pinch で Dolly Cruise（奥行き）が動く
- [ ] pinch 終了後に少し余韻がある
- [ ] pinch 中に tap 誤判定しない

Debug で pinch を見る場合:

- [ ] `pinchActive: true`（操作中）
- [ ] `lastDollyInput: pinch`
- [ ] `dollyVelocity` が 0 以外

## D. 必須導線（1本）

- [ ] tap → IMAGE_ZOOM
- [ ] 拡大画像が出る
- [ ] IMAGE_ZOOM 中 hamburger が出ない
- [ ] IMAGE_ZOOM 中 LIST / Bubble が動かない
- [ ] IMAGE_ZOOM close → PRODUCT_LIST
- [ ] close 後に hamburger と Bubble が戻る
- [ ] hamburger → drawer
- [ ] Food / Gift / Flower が見える
- [ ] drawer close（× または scrim）
- [ ] drawer 中 LIST / Bubble が動かない
- [ ] hamburger → Food → PRODUCT_DETAIL
- [ ] PRODUCT_DETAIL close → PRODUCT_LIST
- [ ] Gift → PRODUCT_DETAIL
- [ ] PRODUCT_DETAIL close → PRODUCT_LIST
- [ ] Flower → PRODUCT_DETAIL
- [ ] PRODUCT_DETAIL close → PRODUCT_LIST
- [ ] DETAIL 中 hamburger が出ない
- [ ] DETAIL 中 LIST / Bubble が動かない

## E. Debug / Review

- [ ] `G` / `D` で Debug HUD と DemoToggles が出る
- [ ] `R` で Review Mode になり Debug UI が消える
- [ ] Review でも PRODUCT_LIST / Bubble / ZOOM / Drawer / Detail は見える
- [ ] 来場者に見せる直前が Review である

## F. 性能

- [ ] LIST idle で FPS が大きく落ちない（目安 55〜60）
- [ ] drag / pinch / Bubble 中も継続して 40fps 以下にならない
- [ ] IMAGE_ZOOM / Drawer / DETAIL / Review でも同様
- [ ] Console に想定外の error がない（CSP warning は既知）
- [ ] Context Lost がない

FPS が悪いとき: Review → pixel ratio cap 1.5 → 1.0 → bubble motion off。

## G. 当日所感（記入）

日付: ________  実施者: ________

- ワールドサイズ: 小さい / ちょうどよい / 大きい
- hamburger / drawer: 押しやすい / 小さい
- pinch: 弱い / よい / 強い（dolly feel 使用: ________）
- Bubble size / radius: ________
- 特記: ________

---

## 判定

- [ ] 必須導線がすべて通る
- [ ] Review で顧客に見せられる
- [ ] 既知問題以外のブロッカーがない

**持ち込み可 / 保留**（どちらか）: ________

---

## 開発 PC 実施結果（2026-08-19）

最終判定は現地 55インチ。ここはソフトウェア導線の確認。

| 項目 | 結果 |
|------|------|
| 環境 | 開発 PC、窓 CSS 524×895、DPR 1、phase 8 |
| 起動 | OK。`[info] 0820 demo renderer ready { phase: 8, screenState: TOP }` |
| TOP → ANIMATION → PRODUCT_LIST | OK（warmup 後 listReady=true） |
| canvas count | 1 |
| displayed / texture | 70 / 70（source 25 → 複製） |
| Bubble | DOM あり。pointer 後 opacity=1 / revealActive=true |
| 1本指 drag | pointer 後 Bubble 表示・reveal。CDP 合成イベント |
| 2本指 pinch / Dolly Cruise | OK。pinchActive=true、lastDollyInput=pinch、velocity 約 -446 → 余韻 -173 |
| tap → IMAGE_ZOOM → close | OK。ZOOM 中 hamburger なし / interaction=false |
| hamburger → drawer → close | OK |
| Food / Gift / Flower → DETAIL → close | OK。各 categoryId 表示後 LIST 復帰 |
| Review Mode | HUD / DemoToggles 非表示 |
| Debug Mode | HUD / DemoToggles 再表示 |
| FPS | LIST 直後 52、以降 56〜60 |
| Console error | なし（CSP unsafe-eval warning のみ。既知） |
| Context Lost | なし |
| 判定 | **開発 PC のソフトウェア導線は持ち込み可。** 55インチ体感（ワールドサイズ / hamburger / pinch 強さ）は現地で最終判断 |
