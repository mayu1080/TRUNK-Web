# Production Phase 7.5 report — 4画面同時タッチ / Bubble 独立性

| 項目 | 内容 |
|------|------|
| 日付 | 2026-09-04 |
| 対象 | Monitor 1〜4 同時タッチ時の LIST camera 干渉と Bubble 1個化 |
| チェック | `cd app` → `npm run build` → `npm run build:production` → `npm run check:production-phase75` → `npm run check:production-phase76` |
| 関連コード | `app/shared/localGestureSession.ts` / `exploreController.ts` / `App.tsx` / `main.ts` / `productionStateCoordinator.ts` |

関連: [`production-touch-gestures.md`](./production-touch-gestures.md) / [`production-phase7-report.md`](./production-phase7-report.md) / [`phase7-site-qa-checklist.md`](./phase7-site-qa-checklist.md)

---

## 判定（先に）

現場の「4面で Bubble が1つ」および「M3 を触ると M1 の LIST が最初の点へびくつく」は、**Bubble 本体のシングルトンが原因ではない**。

本命は **global user activity と local gesture / camera が混線していたこと**、および **M1 の blur 後に残る stale pointermove（最初の接触点）を camera X/Y に再適用していたこと** である。

Windows 標準の白いタッチ円が、触った各モニターの正しい位置に出ることは確認済み。物理パネルと digitizer→display の対応は、少なくともヒット位置については動作している。それでもアプリ側 LIST が他面の touch で動いていた。

対策は LIST world / viewportOffset / 窓配置の再設計ではなく、**interaction state の local 化**である。他窓への touch 複製、global 座標からの Bubble 偽分割、常時 4 Bubble 強制表示はしていない。

---

## 1. 現場で確認できた事実

- 本番は SHARP PN-LM551 × 4。PC からは USB HID タッチとして見える想定。
- 各モニターを触ると、**Windows 標準の白いタッチ円がそのモニターのその位置に出る**。1台あたり最大 10 点程度まで反応する。
- しかしアプリの Bubble は 4面全体で 1個しか出ないように見えた。
- 加えて、次の異常が再現した。

```text
Monitor 1
→ 1本指で touch / drag 中（指は動かさなくてもよい）

その状態で Monitor 3 を新規 touch

→ Monitor 1 側の LIST 画像が、
  Monitor 1 で最初に触っていた点へ向かってびくっと移動する
```

これは Monitor 3 の `pointerdown` が、Monitor 1 の camera / LIST 世界を再度動かしていることを示す。Bubble 数の問題より上流の **camera pan 干渉**である。

---

## 2. 本来の仕様

4 monitor = 4 independent LIST worlds。共有してよいのはシーン遷移と 120秒 Non-Touch など、明示的に全画面同期する application state のみ。

```text
Monitor 1 = LIST World 1 = Touch Session 1 = Camera 1 = Bubble 1
Monitor 2 = LIST World 2 = Touch Session 2 = Camera 2 = Bubble 2
Monitor 3 = LIST World 3 = Touch Session 3 = Camera 3 = Bubble 3
Monitor 4 = LIST World 4 = Touch Session 4 = Camera 4 = Bubble 4
```

| 入力 | 結果 |
|------|------|
| 当該面 1本指 | その面だけ camera X/Y pan。その面だけ Bubble 表示 |
| 当該面 2本指 | その面の X/Y pan 禁止。Bubble は出さない。dolly（縦 swipe / pinch）は既存仕様 |
| 当該面 3本指以上 | その面の gesture 全禁止。OS Task View はアプリだけでは止められない |
| M1=1本 かつ M3=1本 | **全体で2本指ではない**。各面 `activePointerCount=1`、Bubble 2個 |

---

## 3. 原因

### 3.1 結論

Monitor 3 の `pointerdown` が、Monitor 1 に残っていた **古い drag origin（startX / startY）** を camera X/Y に再適用していた。

「最初に触った点へ引っ張られる」見た目は、`dx = startX - lastX` によるスナップバックと一致する。毎フレームの rAF が start 座標を書き直していたわけではない。

### 3.2 再現シーケンス

```text
M1 pointerdown / drag
  → M1 ExploreController が lastX/lastY と startX/startY を保持
  → isDragging = true

M3 pointerdown
  ① REPORT_TOUCH_ACTIVITY
       → 以前は 4窓全部へ trunk:production-state-changed を broadcast
       → M1 React が再描画（gesture と無関係な activity なのに）
  ② OS が M3 に focus
       → M1 window blur
       → 以前は pointers.clear() で M1 の lastX が消える
  ③ Windows / Chromium がキャプチャ喪失のあと、
       最初の接触点（startX/startY）付き pointermove を M1 に残す
  ④ M1 onPointerMove
       dx = clientX(=startX) - lastX
       targetCameraX/Y += dx * dragSensitivity
  ⑤ rAF の smoothing が camera.position を追従
       → LIST が最初のタッチ点方向へびくっと動く
```

ポインタ座標そのものを IPC で他窓へ転送していたわけではない。干渉は **activity の全窓 fan-out + focus/blur による session 破棄 + stale pointer の再適用** である。

### 3.3 層ごとの役割

| 層 | 何が起きていたか |
|----|------------------|
| Main IPC | `REPORT_TOUCH_ACTIVITY` が `broadcastAll`。M3 の idle 報告で M1 まで再 render |
| Renderer `exploreController` | blur で local touch を捨て、stale move を camera XY に書いた（実際の jerk の call path） |
| React `App.tsx` | snapshot / bubble aggregate / touch-routing の `setState` が全窓で走った |
| Three rAF | 犯人ではない。smoothing は既に変わった `targetCameraX/Y` を追うだけ |
| Bubble overlay | モジュールシングleton ではない。各窓 `ExploreHost` → `ExploreController` が1つ |

モジュール級の pointer Map や Zustand 共有ストアは無い。各 BrowserWindow は別 renderer である。それでも **activity IPC と blur が、別 renderer の local pointer 寿命を壊していた**。

### 3.4 Bubble が1つに見えた理由

Bubble state 自体は窓ごとに独立だった。ただし次が重なると、現場では「4面で1個」に見える。

1. M3 の touch が M1 の session を 2本扱い／blur 切断し、M1 Bubble が消える、または誤追従する
2. global activity 再描画と focus 移動が重なり、最後に hit した面だけが残って見える
3. （別件）OS が複数 digitizer を1つの HWND に合流させると、その窓の local finger count が 2以上になり Bubble 非表示。今回の白丸観察とは矛盾しやすいが、切り分け用 Debug は残してある

Bubble 表示判定に **4面合計の finger count** は使っていない。使うと M1=1 / M2=1 で「2本指だから Bubble なし」になり、仕様違反になる。

---

## 4. 対策

LIST world / camera architecture / viewportOffset / bounds / window layout は触っていない。直したのは **interaction の local 化**だけである。

### 4.1 activity と gesture の分離

- `REPORT_TOUCH_ACTIVITY` は **120秒 Non-Touch idle の reset だけ**に使う。
- Main は activity-only のとき **snapshot を全窓へ broadcast しない**（`main.ts`）。
- 送信元 renderer も、gesture identity が変わっていなければ `setSnapshot` しない（`App.tsx`）。
- シーン遷移（AD_IDLE / ANIMATION / PRODUCT_LIST）の同期 broadcast は従来どおり残す。

### 4.2 blur で touch session を捨てない

`onWindowBlur` は mouse/pen だけ外す。**touch pointer の lastX / startX は残す**。他面へ focus が移っても、M1 の 1本指 session は続いている。

### 4.3 stale start replay を pan しない

`decideOneFingerPanMove`（`app/shared/localGestureSession.ts`）:

- その窓の `interactionSessionId` と `ownerMonitorId` / `ownerWindowId` が一致しない event は pan しない
- dragging 中に、座標が **最初の down 点へ大きく戻る** move は `stale-start-replay-ignored`。lastX も camera も更新しない
- 通常の 1本指 drag だけ `one-finger-pan` として `targetCameraX/Y` を書く

camera X/Y の call path:

```text
onPointerMove
 → decideOneFingerPanMove
 → applyPan のときだけ targetCameraX/Y
 → wrapPanLoop
 → rAF updateCameraSmoothing
```

### 4.4 interactionSessionId

各面の touch session に通し番号を付ける。M1 の camera 変更は M1 session 由来の event だけ受け付ける。M3 の session が始まっても M1 の pan には使わない。

pointerId を 4窓共通の一意 ID としては使わない。renderer が既に窓ごとに分かれているため、global pointer registry は追加していない。

### 4.5 Bubble は local finger count のみ

`localBubbleFingerGate(effectiveFingerCount())`

- その BrowserWindow の `max(pointers.size, nativeTouchCount) === 1` のときだけ show
- 2本以上は即 hide
- 4面合計は見ない

構造上、M1+M3 が各1本なら Bubble 2個、4面各1本なら 4個同時に存在できる。常時 4個表示にはしていない。

### 4.6 やらなかったこと

- 1つの touch を 4窓へ複製する
- global screen 座標から monitor を推測して Bubble を置く
- Windows の digitizer remap をアプリで疑似補正する
- Android（PN-LM551 内蔵）向け touch 処理
- LIST world / viewportOffset の再設計

---

## 5. 共有してよい state / local でなければならない state

| 共有してよい（global） | local でなければならない |
|------------------------|---------------------------|
| `globalScene`（AD_IDLE / ANIMATION / PRODUCT_LIST） | `pointers` / `nativeTouchCount` / `gestureMode` |
| 120秒 Non-Touch idle | `dragOrigin` / `lastX` / `lastY` / `interactionSessionId` |
| window stack `1 < 2 < 3 < 4`（`moveTop`、focus はしない） | `targetCameraX/Y` の pan delta |
| debug 用 last-hit / `activeBubbleCount` 集計（観測のみ） | Bubble visible / 座標 / hide timer / reveal |

---

## 6. Debug（D/G 時のみ）

各面 HUD で確認できること:

- `monitorId` / `windowId` / `displayId`
- `interactionSessionId` / `gestureMode` / `activePointerCount` / `nativeTouchCount`
- `cameraX/Y` / `targetCameraX/Y`
- `bubbleVisible` / `bubbleX/Y` / `activeBubbleCount` / `byMonitor`
- `lastCameraUpdateReason` と camera 書き込み ring（`camWrite[0..7]`）
- Touch Routing: `thisWindowId` vs `lastTouchWindowId`、local `touchHits`、debug 時のみ `M{id} TOUCH` マーカー

最重要テスト:

```text
1. M1 を 1本指 touch（指は止めてよい）
2. M3 を touch
3. M1 の cameraX/Y / targetCameraX/Y が 1px でも変わらないこと
```

変化した場合の reason:

| `lastCameraUpdateReason` | 意味 |
|--------------------------|------|
| `one-finger-pan` | 当該面の指が動いた（正常） |
| `stale-start-replay-ignored` | M3 focus 後の start 点 replay を捨てた（対策が効いている） |
| `session-mismatch-ignored` / `foreign-window-ignored` | 別 session / 別窓の event を捨てた |
| camWrite が増えない | M1 の pan 経路自体が走っていない |

Touch Routing:

- M3 を触って `lastTouchWindowId` が M3 の window になる → その BrowserWindow に event が届いている
- 常に同じ `lastTouchWindowId`、触った面の `touchHits` が空、マーカーが別面に出る → OS digitizer→display の Case B。アプリで偽分割しない

---

## 7. 現場で最終確認すべき項目

1. **Test A** — M1 ドラッグ中に M3 down。M1 LIST がびくつかない。debug なら `stale-start-replay-ignored` または camWrite が増えない。
2. **Test B** — M1 と M3 をそれぞれ 1本 drag。camera は各自の finger delta だけ。
3. **Test C** — M1〜M4 各1本。Bubble 4個。`byMonitor: [M1:1 M2:1 M3:1 M4:1]`。`activeBubbleCount=4`。
4. **Test D** — 同一面の 2本指。その面の Bubble は出ない。X/Y pan しない。
5. **Test E** — 120秒無操作で 4面とも AD_IDLE（idle は global のまま）。
6. 1本指 tap → Image_ZOOM、3本指 block、pinch / 縦 swipe dolly、overlay 独立、stack `1 < 2 < 3 < 4` の回帰。

---

## 8. Windows 側に残る切り分け

アプリだけでは止められないもの:

- 3本指スワイプの Task View / デスクトップ表示。会場では **Bluetooth とデバイス → タッチ → 3本指と4本指のタッチジェスチャ = オフ**。
- 万一、白丸は正しい面なのに `lastTouchWindowId` が1つに固定される場合は、HID をタブレット PC 設定 / `tabcal` でディスプレイへ 1:1 割り当て。ディスプレイは **拡張**（複製禁止）。

digitizer remap は OS の仕事。アプリでは行わない。

---

## 9. build / check

| コマンド | 結果 |
|----------|------|
| `npm run build` | ok |
| `npm run build:production` | ok |
| `check:production-content` | ok（既存 non-fatal warning のみ） |
| `check:production-phase7` / `71` / `74` / `75` | ok |
| `check:production-phase76` | ok（`simulateTwoMonitorPanIsolation`: M1 不动・M3 pan、local bubble gate） |

---

## 10. 変更ファイル（対策実装）

- `app/shared/localGestureSession.ts` — session gate / stale replay 判定 / 隔離シミュレーション
- `app/renderer/production/src/three/exploreController.ts` — local session、blur で touch を残す、pan を decide 経由に
- `app/renderer/production/src/App.tsx` — activity では snapshot を捨てない
- `app/electron/main.ts` — activity-only は `broadcastAll` しない
- `app/electron/production/productionStateCoordinator.ts` — `REPORT_TOUCH_ACTIVITY` は idle 専用と明記
- `app/scripts/check-production-phase76.js`
- 既存の Phase 7.5 Touch Routing Debug（`TouchMarker` / mapping dump）はそのまま診断用

`demo-0820`、LIST independent world、viewportOffset は未変更。
