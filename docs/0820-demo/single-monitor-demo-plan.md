# 8/20 single-monitor demo 方針書・実装計画

当日起動・チェックリスト: [`launch-notes.md`](./launch-notes.md) / [`final-smoke-test.md`](./final-smoke-test.md)  
別 Windows: [`transfer-test.md`](./transfer-test.md)


| 項目 | 内容 |
|------|------|
| 版 | 1.0 |
| 作成日 | 2026-08-18 |
| デモ日 | 2026-08-20 |
| 目的 | 55インチ縦タッチ 1 台で PRODUCT_LIST 体験を確認・披露する |
| 本ドキュメントの範囲 | **方針・計画のみ**。実装コード変更は含まない |
| 前提 | 本番 4 面の完全再現ではない。1 枚モニターの体験デモ |

機械可読版: [`single-monitor-demo-plan.json`](./single-monitor-demo-plan.json)

Frozen Reference: [`category-drawer-frozen-reference.md`](./category-drawer-frozen-reference.md)

---

## 1. デモ目的

8/20 に、55インチ縦タッチモニター **1 台** で次を確認・披露する。

- PRODUCT_LIST の描画体験
- Three.js LIST 空間
- Bubble Color Reveal
- 画像 tap → IMAGE_ZOOM → close → PRODUCT_LIST
- CategoryDrawer（**DI 見た目の忠実再現**。再設計しない）
- Category select → PRODUCT_DETAIL **風**画面 → close → PRODUCT_LIST
- 1 本の Electron アプリとしての画面遷移
- UI/UX・描画・WinTouch 操作

**本番 4 面環境の完全再現ではない。** 同期・管理モニター本番仕様は対象外。監視用モニターは開発確認用。

---

## 2. デモ環境

| 項目 | 方針 |
|------|------|
| ランタイム | **Electron 開発起動**（`exe` 化は必須ではない） |
| OS / 入力 | Windows / **WinTouch** 想定 |
| 体験モニター | 55インチ縦タッチ **1 台** |
| 監視用モニター | 開発確認（Debug / DevTools / 起動ログ）。キオスク仕様にしない |
| 4 面同期 | **再現しない**。`TRUNK_MONITOR_COUNT=1` 相当 |
| 起動 | 手順は Phase 8 でメモ化。当日はこのメモで立ち上げる |

### 2.1 解像度 / scale

UI は **フルHD縦相当（1080×1920 CSS px）を基準**に成立させる。4K パネルでも、Windows の表示スケールで CSS サイズが変わる点を当日 Debug で確認する。

```text
designW = 1080
designH = 1920
uiScale = clamp(min(innerWidth / designW, innerHeight / designH), 0.75, 2.0)
```

- DOM UI（hamburger 52px、drawer 320px 等）は **Frozen Reference の px を正**とする。勝手に拡大しない。
- **Bubble だけ** `sizePx` / `revealRadiusPx` を `uiScale` または当日調整値で変えてよい（DI 初期値 320 / 160 が 4K 100% だと画面比で小さくなるため）。
- Three `setPixelRatio(min(devicePixelRatio, cap))`。cap 初期候補は **2**。
- canvas CSS size と drawing buffer size を Debug に出す。

### 2.2 Debug 必須表示（debug mode のみ）

Review Mode では隠す（DI と同じ。Bubble 演出自体は Review で見える）。

| 項目 | 例 |
|------|-----|
| `window.innerWidth` / `innerHeight` | CSS ビューポート |
| `devicePixelRatio` | DPR |
| canvas CSS width/height | レイアウト |
| drawingBufferWidth / Height | GPU バッファ |
| `uiScale` | 上記計算値 |
| FPS | 平均 |
| `realImageCount` | 実ファイル数 |
| `displayedImageCount` / card count | 70 相当 |
| `duplicatedCount` | 複製数 |
| `instanceId` / source image id | 選択中 |
| Bubble `sizePx` / `revealRadiusPx` | 当日調整用 |
| screenState / drawer / overlay | 遷移確認 |

キーボードは DI に合わせ **G/D = debug、R = review**。当日披露は Review 既定。

### 2.3 監視用モニター

- 体験は 55インチ縦のみ。
- PC 本体または副画面に Debug / コンソールを出してよい。
- 第 2 BrowserWindow を「本番管理モニター」としては作らない。必要なら Electron 窓を副画面に置くだけ。

---

## 3. 必須画面遷移

```text
TOP → ANIMATION → PRODUCT_LIST

PRODUCT_LIST 画像 tap → IMAGE_ZOOM
IMAGE_ZOOM close → PRODUCT_LIST

hamburger → CategoryDrawer
CategoryDrawer close（hamburger × または scrim）

Category select → PRODUCT_DETAIL 風
PRODUCT_DETAIL close → PRODUCT_LIST
```

| 画面 | 8/20 の完成度 |
|------|----------------|
| TOP | **見た目仮で可**（暗色 + 有効タップ） |
| ANIMATION | **見た目仮で可**（短い待ち → 自動 LIST） |
| PRODUCT_LIST | **本命**。Three + Bubble |
| IMAGE_ZOOM | 白 overlay/card。× → 常に LIST |
| CategoryDrawer | **DI 忠実再現**（独立 screenState ではない） |
| PRODUCT_DETAIL | **プレースホルダーで可**（白画面 + カテゴリ名 + ×） |

状態は本番 ID を使う: `TOP` / `ANIMATION` / `PRODUCT_LIST` / `IMAGE_ZOOM` / `PRODUCT_DETAIL` + `uiState.categoryDrawer`.

### 3.1 既存本番遷移との接続（推奨）

`app/shared/transitions.ts` と `trunkApi.dispatch` を流用する（MONITOR_COUNT=1）。

| 注意 | 内容 |
|------|------|
| IMAGE_ZOOM 中の Three | **破棄しない**。暗背景として残し、interaction / Bubble のみ停止 |
| DETAIL 中の Three | 8/20 は **非表示または操作停止**で可。破棄必須ではない（メモリは 1 面のみ） |
| TOP 復帰 | Three dispose してよい（当日 idle が走る場合） |
| `LIST_IMAGE_TAP` | `imageId` に **instanceId** を渡す。`test-image` フォールバックはデモ経路で使わない |
| drawer open 中 | LIST tap を受けない（DI どおり interaction off） |

idle: 開発既定 20 秒は当日誤爆する。8/20 起動は **600 秒または idle 無効** を起動メモに書く。

---

## 4. DI から移植するもの

**DI ディレクトリを `app/` に丸ごとコピーしない。** モジュール単位で再構成する。LIST_demo / DF / DE / DD / DB / DA は変更しない。

| 機能 | 移植 | 備考 |
|------|:----:|------|
| Three.js 写真空間（PerspectiveCamera, fog, Plane） | ○ | 1 canvas |
| camera drag（1 本指 pan） | ○ | |
| wheel / Shift+wheel | △ | キオスク非必須。開発のみ可。**本番操作は pinch** |
| Raycaster tap | ○ | |
| IMAGE_ZOOM 連携 | ○ | overlay DOM。copy は仮で可 |
| DOM BubbleOverlay（SVG、`pointer-events: none`） | ○ | |
| screen-space reveal shader | ○ | |
| Bubble 追従 / smoothing / hideDelay | ○ | 55インチで再調整可 |
| ZOOM / drawer / DETAIL 中の Bubble 停止 | ○ | |
| CategoryDrawer 見た目 | ○ | **Frozen Reference 厳守** |
| Review / Debug | ○ | 顧客披露は Review。Debug は確認用 |
| DemoBanner / visual preset 大量トグル | × | 8/20 必須ではない。Debug 限定なら可 |
| Vite `/content` middleware | × | `getAssetIndex` + `getContentFileUrl` |
| DI mock fallback 画像 | × | 実画像を複製する。ゼロ枚のときだけエラー |

### 4.1 Bubble Color Reveal（必須披露）

DI 初期値（55インチで調整可）:

| key | DI 初期値 |
|-----|-----------|
| sizePx | 320 |
| revealRadiusPx | 160 |
| followSmoothing | 0.18 |
| hideDelayMs | 600 |
| showOnPointerMove | true（PC）。タッチは接触中表示を推奨 |
| revealMode | shader |
| motion | elegant（呼吸 + 対岸 2 glint） |

ゲート:

```text
bubbleAllowed =
  screenState === PRODUCT_LIST
  && categoryDrawer !== 'open'
  && enabled
```

IMAGE_ZOOM / CategoryDrawer / PRODUCT_DETAIL では停止・非表示。Review Mode でも Bubble UI とカラー復帰は見える。

### 4.2 タッチ操作（WinTouch）

| 操作 | 8/20 |
|------|------|
| 1 本指 drag | camera pan |
| 短い tap | Raycaster → IMAGE_ZOOM |
| ピンチ | **実装する**（dolly/zoom）。DI の wheel の当日代替 |
| Bubble | `pointer-events: none`。canvas がヒットを取る |
| hover 常時 Bubble | 必須にしない。接触中表示でよい |

---

## 5. CategoryDrawer Frozen Reference 方針

詳細は [`category-drawer-frozen-reference.md`](./category-drawer-frozen-reference.md)（本 Phase 0 で作成済み）。

- **再設計禁止。** 合格は DI に近く見えること。
- 変更禁止: 色 / 余白 / サイズ / 角丸 / アニメーション / 文言 / 大きな構造。
- hamburger は右辺縦中央の円。パネル幅 320px。文言 Explore / Category / Food / Gift / Flower。
- パネル内に新しい × を足さない（閉じるのは hamburger × と scrim）。
- **許容する配線差:** select → PRODUCT_DETAIL placeholder（DI は選択するだけ）。

実装前に Frozen Reference を読み、差分が出たらコードを「良くする」のではなく Reference 側に不明点として残す。

---

## 6. 画像 70 カード化方針

8/20 は現在の `content/` 素材を流用する。実ファイルが 20 枚前後でも **エラーにしない**。70 カード相当に複製して LIST を埋める。

本番の thumb 化は 8/20 では必須にしない（フル解像度流用を許容）。

### 6.1 ID モデル

DI の `__dupNNN` をそのまま流用せず、役割を分ける。

```text
ListCard {
  instanceId      // カード一意。Raycaster / selected に使う
  sourceImageId   // assetIndex.listImages[].id（元ファイル）
  relativePath
  url             // getContentFileUrl(relativePath)
  duplicated      // true なら使い回し
}
```

例: 実画像 20 枚 → instanceId `card_001` … `card_070`、sourceImageId は 20 種を循環。

IMAGE_ZOOM は `instanceId` でカードを引き、**表示画像は source の url**（同じファイルを複数カードが共有してよい）。

`LIST_IMAGE_TAP.imageId` には `instanceId` を渡す。Main の `selectedListImageId` に入る。ZOOM 側で card 表を引く。

ゼロ枚のときだけ起動失敗または LIST エラー表示。20 枚不足は warning + Debug 表示のみ。

### 6.2 Debug

- `realImageCount`
- `displayedImageCount`（目標 70）
- `duplicatedCount`
- 選択中 `instanceId` / `sourceImageId`

`TARGET_IMAGE_COUNT = 70`。70 超の実画像があれば 70 にキャップ（DI `imageSelection.ts` と同趣旨）。

---

## 7. 実装 Phase

実装コードに入る前に、ライブラリ追加（React / Three / framer-motion 等）と配置場所を確認する。本計画の推奨配置:

```text
app/renderer/demo-0820/     # 新規 Vite+React Renderer（LIST_demo は触らない）
Electron: TRUNK_DEMO=0820, TRUNK_MONITOR_COUNT=1
既存 state-dev.html / content 層 / transitions は残す
```

| Phase | 内容 | 完了の目安 |
|-------|------|------------|
| **0** | 本方針書 + Frozen Reference | **本ドキュメントで完了** |
| **1** | 8/20 demo mode。Electron 1 window、screenState 骨格、TOP/ANIMATION 仮 | `npm` 開発起動で TOP→LIST 仮遷移 |
| **2** | PRODUCT_LIST に Three LIST + Bubble（DI 相当）。content は後続でも仮画像可 | 1 canvas、Bubble 見える |
| **3** | `getAssetIndex` + `getContentFileUrl` → 70 カード展開 | Debug に実枚数/カード数 |
| **4** | tap → IMAGE_ZOOM → close。ZOOM 中 Bubble/操作停止。canvas は残す | 必須遷移 |
| **5** | CategoryDrawer を Frozen Reference どおり再現 | DI と並べて見た目一致 |
| **6** | select → PRODUCT_DETAIL placeholder → close | 必須遷移 |
| **7** | 55インチ縦・WinTouch・Debug（解像度/DPR/canvas/Bubble） | 当日調整値をメモ |
| **8** | 起動メモ（コマンド、環境変数、Review 切替、トラブル時） | `docs/0820-demo/launch-notes.md` を実装後に作成 |

Phase 2 と 3 は連続してよい。Phase 5 は Frozen Reference を横に置いて進める。

---

## 8. やらないこと

- 本番 4 面同期の完成
- 管理モニター本番仕様
- PRODUCT_DETAIL 本実装（カルーセル・products 本接続は任意。placeholder で可）
- Vercel 公開必須化
- exe パッケージ必須化
- CategoryDrawer の再デザイン
- DI を `app/` に丸ごとコピー
- LIST_demo 本体を壊すこと
- DF / DE / DD / DB / DA の変更
- 本番 architecture の「LIST 描画方式の最終確定」を 8/20 だけで行うこと（デモは Three 体験確認。本採用ゲートは別）

---

## 9. リスク

| リスク | 深刻度 | 対策 |
|--------|:------:|------|
| 55インチで Bubble が小さい/大きい | 高 | Debug で sizePx 調整。`uiScale` 連動。初期 320/160 |
| 4K CSS px vs FHD（見た目半分） | 高 | innerWidth を当日確認。4K 100% なら uiScale≈2 を Bubble に適用。drawer は原則固定（変更は承認後） |
| WinTouch の pointer / hover 残り / tap vs pan | 高 | 閾値は DI（16px / 600ms）を初期値。実機で調整 |
| ピンチ未実装のまま当日 | 中 | Phase 7 優先。最低限 pan + tap は必須 |
| 複製カードの selected id 取り違え | 中 | instanceId と sourceImageId を分離。ZOOM は source url |
| CategoryDrawer 再現差分 | 中 | Frozen Reference。差分は報告のみ |
| Bubble と tap/drag 競合 | 中 | `pointer-events: none` + ZOOM/drawer ゲート |
| shader / 70 texture / 1 面でも GPU | 中 | pixelRatio cap、失敗 skip、Context Lost ログ |
| `file://` を TextureLoader が読めない | 高 | 実装 Phase 3 でプロトコル確認。必要ならカスタム scheme |
| Electron 開発起動の当日失敗 | 高 | Phase 8 メモ、事前に同じ PC で 1 回起動 |
| 開発 idle 20 秒 | 中 | 起動時 600s または無効 |
| React/Three 未導入の app にスタック追加 | 中 | demo-0820 に閉じる。既存 content/state は共有 |

---

## 10. 合格条件（8/20 時点）

**Must**

- [ ] Electron 開発起動で立ち上がる
- [ ] 55インチ縦 1 枚で PRODUCT_LIST（Three 空間）が表示される
- [ ] Bubble Color Reveal が見える（白黒空間 + 円内カラー）
- [ ] 画像 tap で IMAGE_ZOOM に行ける
- [ ] close で PRODUCT_LIST に戻れる（Three が消えたり初期化され直して体験が壊れない）
- [ ] hamburger で CategoryDrawer が開く（DI に近く見える）
- [ ] drawer を閉じられる
- [ ] category select で PRODUCT_DETAIL placeholder へ行ける
- [ ] PRODUCT_DETAIL close で PRODUCT_LIST に戻れる
- [ ] ZOOM / drawer / DETAIL 中に Bubble が止まる
- [ ] Debug で innerWidth/Height、DPR、canvas CSS / drawing buffer、FPS、realImageCount、card count を確認できる
- [ ] 実画像不足で落ちない（70 カード相当）
- [ ] 操作不能になる重大バグがない

**Should**

- [ ] 1 本指 pan が破綻しない
- [ ] ピンチ zoom/dolly が使える
- [ ] Review Mode 既定で Debug が隠れ、Bubble は見える
- [ ] FPS が大きく落ち込まない（目安 55fps+。1 面）

**Must not**

- [ ] CategoryDrawer が「新しく良く」見える方向に再デザインされていない
- [ ] LIST_demo / 他デモが壊れていない
- [ ] 4 面同期や exe 必須になっていない

---

## 11. 起動メモに残す項目（Phase 8 で文書化）

実装後に `docs/0820-demo/launch-notes.md` へ。今は項目のみ。

- `cd app` 後の install / 開発起動コマンド
- `TRUNK_DEMO=0820` / `TRUNK_MONITOR_COUNT=1` / idle 秒数
- 55インチをメインにして fullscreen または最大化する手順
- Review / Debug 切替（R / G / D）
- content パス（`TRUNK_CONTENT_ROOT`）
- 失敗時: ポート、GPU、window 位置、タッチがマウス扱いになっていないか

---

## 12. 未確認点（実装前に残っているもの）

推測で埋めない。実装 Phase に入る前、または当日朝に確認する。

1. 当日 55インチの **実際の innerWidth/innerHeight/DPR**（4K 100% か、FHD 相当スケールか）
2. `content/images/list` の **実ファイル枚数**（ワークスペース上は list 配下が確認しづらい。20 前後想定）
3. Electron sandbox 下で `getContentFileUrl`（`file://`）を Three が読めるか
4. 8/20 Renderer に React を足すことの最終承認（本計画は必要と判断）
5. WinTouch でピンチが 2 本指 gesture として来るか
6. hamburger 52px を 55インチで発注者が小さいと感じるか（小さい場合も勝手に変えない）
7. PRODUCT_DETAIL placeholder の最低限コピー（カテゴリ名 + × 以外に何を出すか）
8. IMAGE_ZOOM の本文を DI `zoomContent` 仮にするか、空でもよいか

---

## 付録 A — 読んだ資料

- `LIST_demo/reports/DI-three-bubble-reveal-implementation-report.json` / `.md`
- `LIST_demo/reports/production-product-list-integration-plan.md`
- `LIST_demo/reports/product-list-demo-strategy.json`
- `README.md` / `app/README.md` / `docs/architecture.md` / `docs/screen-flow.md` / `.json`
- `docs/content-schema.md` / `content/README.md`
- `app/shared/state.ts` / `transitions.ts` / `idleConfig.ts`
- `app/electron/state/stateCoordinator.ts` / `main.ts` / `preload.ts` / content 層
- `app/renderer/state-dev.html` / `idle-timer.js`
- DI: `CategoryDrawer.tsx` / `styles.css` / `motionConfig.ts` / `App.tsx` / `bubbleConfig.ts` / `imageSelection.ts`

## 付録 B — 本番レビューからの引き継ぎ（8/20 に効くもの）

- Three を `screenState===PRODUCT_LIST` だけで mount すると ZOOM で破棄される → **ZOOM 中は残す**
- 本番フィールド名は `selectedListImageId`（DI の `selectedImageId` と別名）
- `LIST_IMAGE_TAP` の `test-image` をデモ経路に残さない
- drawer は独立 screenState ではない
- 4 面同時 GPU は今回対象外（1 context）
