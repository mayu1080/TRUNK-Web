# Production App Architecture

| 項目 | 内容 |
|------|------|
| 版 | 0.2 |
| 日付 | 2026-08-29 |
| フェーズ | Phase 0 設計 + AD_IDLE を「4画面で1つの広告」として補正 |
| 機械可読版 | [`production-app-architecture.json`](./production-app-architecture.json) |

関連:

- [`production-state-flow.md`](./production-state-flow.md)
- [`production-touch-gestures.md`](./production-touch-gestures.md)
- [`production-content-schema.md`](./production-content-schema.md)
- [`production-implementation-plan.md`](./production-implementation-plan.md)

---

## 0. 本書の位置づけ

本番実装に入る前の **アプリ構成・Window・状態協調・広告方式** の正（Source of Truth）とする。

| 資料 | 本番での扱い |
|------|----------------|
| 8/20 `demo-0820` | **体験の大枠の正**。LIST / Bubble / ジェスチャ質感 / Drawer 見た目はここを継承する |
| 本ディレクトリ `docs/production/*` | **本番ランタイムの正**。4画面同期・AD_IDLE・120秒全体復帰・overlay 独立性 |
| `docs/architecture.md` / `docs/screen-flow.*` | 2026-05〜07 時点の設計。`TOP`・10分/面・IMAGE_ZOOM を screenState とする点は **本番では本仕様が上書き** |
| `docs/function.xlsx` / `Design_Check0622.mp4` | 要件の歴史資料。差分は §0.1 と state-flow の差分表を優先 |

フローチャートや過去資料と 8/20 デモが食い違う場合は、**デモで成立した実装を大枠の正**とする。ただし本番固有の確定事項（4画面広告、全体120秒、overlay 独立、アプリ内動画）はデモより優先する。

### 0.1 過去仕様からの主な上書き

| 旧 | 本番 |
|----|------|
| 画面状態 `TOP` | グローバルシーン `AD_IDLE`（**4画面で1つの広告コンテンツを同期表示**。素材の4本/1本は Phase 2） |
| IMAGE_ZOOM / PRODUCT_DETAIL を `screenState` | `globalScene=PRODUCT_LIST` 上の **per-monitor `localOverlay`** |
| 無操作 10分・当該モニターのみ TOP | **全体 120秒** Non-Touch → 全モニター `AD_IDLE` |
| 1台だけ TOP のとき他台を巻き込まない | 全体 idle のため、探索中は全台が同じ `globalScene`。overlay だけ独立 |
| ロゴを LIST に出せる（0820） | LIST には出さない。ZOOM / Category modal のみ。素材は `content/Logo` |
| PRODUCT_DETAIL placeholder | Category modal（カテゴリ別画像ギャラリー） |
| 広告は外部 Player 比較が残る | **第一候補は Electron 内再生（B案）** |

---

## 1. 目的

Windows 現場 PC 1台・タッチモニター最大4台で、不特定多数（最大4グループ）が同時に探索できるキオスクを提供する。

```text
4画面広告放映（AD_IDLE）
  ↓ どのモニターでも 1本指以上の touch
4画面アニメーション（ANIMATION）
  ↓ animation end（touch では skip しない）
4画面 PRODUCT_LIST
  ↓ 以後、各モニターは独立したタッチ体験
```

同期するのは主に次だけである。

- `AD_IDLE`（4画面で1つの広告。面ごとに別広告を流す状態ではない）
- `ANIMATION`
- `PRODUCT_LIST` への入場
- 全体無操作 120秒で `AD_IDLE` へ戻す処理

`PRODUCT_LIST` 入場後の pan / dolly / Bubble / IMAGE_ZOOM / Drawer / Category modal は **モニター単位で独立**する。

---

## 2. 推奨アーキテクチャ（1-1）

前提:

- Electron app（1 Main Process）
- タッチモニター用 **4 BrowserWindow**
- アプリ内広告動画再生
- アプリ内アニメーション動画再生
- Three.js `PRODUCT_LIST`（8/20 デモで成立した描画を本番核とする）
- per-monitor local interaction
- shared content layer（起動時 `assetIndex`。描画中 FS スキャン禁止）

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  Windows PC（タッチ×4 + 管理モニターは対象外）                              │
│                                                                          │
│  TRUNK.exe                         content/（exe 横・差し替え可）          │
│  ┌───────────────────────────┐    ┌──────────────────────────────────┐  │
│  │ Main Process              │    │ manifest.json                    │  │
│  │  StateCoordinator         │    │ ads/  animation/  images/        │  │
│  │  ContentService           │◄───│ categories.json  products.json   │  │
│  │  TouchActivityManager     │    │ Logo/  monitor-layout.json       │  │
│  │  VideoSyncController      │    └──────────────────────────────────┘  │
│  │  Log / Debug              │                                          │
│  │  4× BrowserWindow         │                                          │
│  └─────────────┬─────────────┘                                          │
│                │ preload（contextIsolation）                              │
│  ┌─────────────▼─────────────┐ ×4（monitorId 1..4）                      │
│  │ Renderer                  │                                          │
│  │  AD_IDLE video            │                                          │
│  │  ANIMATION video          │                                          │
│  │  Three PRODUCT_LIST       │                                          │
│  │  local overlays / Bubble  │                                          │
│  └───────────────────────────┘                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**原則**

- 表示は常にローカル `content/`（ネットワーク非依存）
- 4面同期 IPC は Electron Main 中央管理。WebSocket / UDP は使わない
- Renderer は生 `fs` を持たない
- 管理モニターは大画面解像度・タッチ体験の対象に含めない

8/20 との関係: `demo-0820` は **1 BrowserWindow / `TRUNK_MONITOR_COUNT=1`**。本番は同じ Renderer 系統を 4 window に載せ、Main のグローバルシーンを足す。LIST の ExploreController は **window ごとに独立インスタンス**（共有シミュレーションにしない）。

---

## 3. 4画面 Window 構成（1-2）

### 3.1 構成

| 項目 | 本番 |
|------|------|
| 体験 Window | 4（`monitorId` 1〜4） |
| 対象 | 4 タッチモニターのみ |
| 管理モニター | **別画面扱い**。体験 Window を割り当てない。4面連結の解像度計算に含めない |
| キオスク | 体験 Window は各タッチ display に bounds 照合して配置（fullscreen / kiosk は Phase 1 で確定） |

`monitorId` は起動時に Main が割り当て、preload `getConfig().monitorId` で Renderer に渡す。WebContents → monitorId の対応は Main が保持する（現行 `main.ts` と同じ方向）。

### 3.2 monitor layout config

物理配置とワールド viewport は **JSON 化する**。第一候補パス:

```text
content/monitor-layout.json
```

開発上書き: 環境変数 `TRUNK_MONITOR_LAYOUT` またはリポジトリ `app/` 配下の開発用コピー（実装時に1箇所に決める。未決は §12）。

含めたいフィールド:

| フィールド | 意味 |
|------------|------|
| `monitorId` | 1..4 |
| `x` `y` `width` `height` | 期待する OS 画面座標・サイズ（px） |
| `orientation` | `portrait` / `landscape` |
| `viewportOffsetX` `viewportOffsetY` | LIST 世界での初期カメラ／ビューオフセット |
| `scale` | 当該面の表示スケール |

ルートに `boundsMatchTolerancePx`（予備 pixel tolerance）を置く。実 display の bounds と config の差が tolerance 以内ならその display に載せる。超過したらログし、フォールバック規則（primary からの相対、または起動拒否）を Phase 1 で決める。

管理モニターは配列に載せない。OS が 5 枚目を報告しても体験 Window は 4 まで。

### 3.3 Window bounds 照合

起動時:

1. `screen.getAllDisplays()` を取得
2. 管理モニターを除外する規則を適用（未決: 最小辺・DPI・手動 ID のどれか）
3. 残り 4 枚を `monitor-layout.json` と照合（位置 + サイズ、tolerance 付き）
4. 各 `BrowserWindow` を対応 display に配置
5. 不一致は fatal または degraded 起動（運用方針は未決。ログは必須）

8/20 は primary display の縦向き判定のみ。本番では **config 駆動**に置き換える。

### 3.4 開発時

4 実機が無い場合は、縮小 Window を 2×2 に並べる開発モードを残してよい。`globalScene` / overlay 独立性のテストは開発モードでも成立させる。実機 bounds 照合は現場 Phase 7。

---

## 4. 状態モデル（1-3）

グローバルシーンとローカル overlay を分離する。8/20 の `screenState = IMAGE_ZOOM` は本番では **localOverlay** に落とす。

```ts
type GlobalScene =
  | 'AD_IDLE'
  | 'ANIMATION'
  | 'PRODUCT_LIST';

type LocalOverlay =
  | 'NONE'
  | 'IMAGE_ZOOM'
  | 'CATEGORY_DRAWER'
  | 'CATEGORY_MODAL';

type PerMonitorState = {
  monitorId: number;
  localOverlay: LocalOverlay;
  selectedImageId: string | null;
  selectedCategoryId: string | null;
  cameraState: CameraState;
  bubbleState: BubbleState;
  interactionLocked: boolean;
};
```

`interactionLocked === true` のとき、**そのモニターだけ**背面 LIST の pan / dolly / tap / Bubble 駆動を止める。他モニターは止めない。

`CATEGORY_MODAL` は 8/20 の `PRODUCT_DETAIL` placeholder の本番形。状態 ID は `CATEGORY_MODAL` を正とする。旧名 `PRODUCT_DETAIL` はドキュメント上の別名として残してよいが、新規コードでは使わない。

### 4.1 State Coordinator（Main）

| モジュール | 責務 |
|------------|------|
| **StateCoordinator** | `globalScene` と 4 件の `PerMonitorState` の唯一の書き手。IPC `dispatch` を受け、対象 window へ broadcast |
| **ContentService** | `contentRoot` 解決、JSON 検証、`assetIndex`、動画パス、Logo、layout config |
| **TouchActivityManager** | 全モニターの最後の **有効操作**時刻。120秒判定。Bubble 追従や hover 的 move は無視 |
| **VideoSyncController** | AD_IDLE / ANIMATION の 4 本動画を同時 start / seek / loop / end 判定 |
| **Log / Debug** | 構造化ログ。開発時は globalScene・各 overlay・lastTouchAt・video clock を出す。本番顧客 UI には出さない |

Renderer はローカルにカメラ積分・ポインタ・Three を持つ。Main が毎フレームのカメラを持たない。overlay 開閉とグローバル遷移だけ Main が権威を持つ。

カメラの Main 保持は必須ではない。`PerMonitorState.cameraState` は「概念上 per-monitor」であり、実装では Renderer ローカル + 必要ならデバッグ用スナップショットでよい（未決: Main へ定期同期するか）。

### 4.2 所有権

| 状態 | 権威 | 備考 |
|------|------|------|
| `globalScene` | Main | 4 window 同一 |
| `localOverlay` / 選択 ID | Main | 当該 window にだけ効く |
| LIST カメラ / dolly / カード積分 | 各 Renderer | クローン世界 |
| Bubble | 各 Renderer | 触っている面だけ表示 |
| lastValidTouchAt | Main | 4面で1本の時計 |
| 動画 clock | Main + 各 Renderer | Main が start 指令、各面が自モニター用ファイルを再生 |

---

## 5. 4画面 LIST の世界（K）

### 5.1 shared / per-monitor

```text
shared:
  base world layout（seed、配置レンジ、カード寸法ルール）
  card dataset（assetIndex 由来）
  initial positions
  content source

per monitor:
  viewport（layout の offset / scale）
  camera / pan / dolly
  Bubble
  selected image
  CategoryDrawer
  Category modal
```

**クローン世界**: 4面で1つの物理シミュレーションを共有しない。同じ seed / dataset からモニターごとに Explore インスタンスを作る。入場直後は `viewportOffset*` で「4面で1つの空間に入る」見た目を出す。入場後の操作でカメラは乖離してよい。

共有シミュレーションにすると、1面の dolly が他面のカードを動かしてしまい、独立体験と矛盾する。

### 5.2 入場演出と独立操作

| 時点 | 期待 |
|------|------|
| ANIMATION → PRODUCT_LIST | 4面同時に LIST を出す。初期カメラは layout offset 済み |
| LIST 中 | 各面が独自に pan / dolly / overlay |
| 全体 120秒 → AD_IDLE | 全面のカメラ・overlay・Bubble・gesture を破棄／初期化 |

---

## 6. 広告方式比較（必須）

### 6.1 候補

| 案 | 内容 |
|----|------|
| **A案** | 外部 Player（例: サイネージ / MPC / 専用再生アプリ）が前面で広告。Electron は背面または最小化。touch で Electron を前面化 |
| **B案（推奨・第一候補）** | 広告動画も Electron 内。`AD_IDLE` = **4画面で1つの広告コンテンツを同期表示**している待機状態 |

### 6.2 比較

| 観点 | A案 外部 Player | B案 アプリ内再生 |
|------|-----------------|------------------|
| タッチ検出 | Player がヒットを奪う。前面化レース・フォーカス負けが起きやすい | 同じ BrowserWindow が pointer を受ける。AD_IDLE の touch をそのまま ANIMATION にできる |
| 4画面同期 | 外部4インスタンスと Electron 4 window の二重同期。開始ずれ・終了ずれを OS に依存 | Main の `VideoSyncController` が4本を同時 play。既存 IPC と同一経路 |
| 120秒復帰 | 前面化解除＋Player 再開の順序が必要。途中でフォーカスが残ると広告に戻れない | `globalScene=AD_IDLE` に戻せば動画を再 start / loop するだけ |
| フォーカス問題 | WinTouch + 別プロセスは既知リスク。キオスクで Alt-Tab 相当が起きうる | 体験 Window を常時前面にできる |
| Windows 運用 | Player の自動起動、z-order、クラッシュ時の二重復旧 | プロセスは TRUNK.exe のみ。スタートアップが単純 |
| コンテンツ差し替え | Player 側プレイリストと `content/` が分裂 | `content/ads/` を差し替えて再起動。他素材と同じ運用 |
| 起動ラグ | Player 起動 + Electron 起動 | Electron 起動後に video デコード。4本同時は GPU/IO 負荷（検証対象） |
| 本番安定性 | プロセス間依存が増える | 単一アプリ。video デコード失敗時はプレースホルダ＋ログで継続方針を取れる |

### 6.3 推奨

**B案を採用する。** A案は比較対象として残すが、本番第一候補ではない。

B案のリスク（4本同時デコード、コーデック、ループ同期）は Phase 2 / 7 で実機確認する。コーデック第一候補は H.264 + AAC（Windows / Chromium 互換）。4K 4本同時は未決（解像度・bitrate を現場で決める）。

---

## 7. 動画同期（J）

**論理:** 広告もアニメーションも「1コンテンツを4画面に同期表示」する。面ごとに別番組を流すモードではない。`adMode = four-screen-synced-content`。

**素材の持ち方（Phase 2 確定）:** 候補 C（`ads.json` / `animation.json`）+ 規約パス `ads/monitor-N.mp4`・`animation/monitor-N.mp4`。wall 1本 crop は採用しない。

| 候補 | 内容 | Phase 2 |
|------|------|---------|
| A | 4画面分割済みの動画4本（`content/ads/monitor-N.mp4`）。同時 start して1つの壁にする | 規約パスとして採用 |
| B | 4画面連結の大判1本（`content/ads/wall.mp4`）を各 monitor が viewport crop | 不採用 |
| C | `ads.json` で1コンテンツに4面分の素材を紐づける | 採用 |

`VideoSyncController` の想定:

- `AD_IDLE`: 1コンテンツを4面同期。ループは **共通 clock**。面ごとに勝手に loop して壁がずれないこと
- `ANIMATION`: 同様に4面同期。**touch で skip / 早送りしない**
- 欠落ファイルは起動時検証（運用方針は content-schema）

---

## 8. Overlay 独立性（F）と Bubble（G）

定義: Overlay は `PRODUCT_LIST` 上に一時的に重なる **1画面 UI**。

対象: `IMAGE_ZOOM` / `CATEGORY_DRAWER` / `CATEGORY_MODAL`。

| 面 | 挙動 |
|----|------|
| overlay を開いた monitor | overlay 表示。背面 LIST 操作ロック。Bubble 停止 |
| 他 3 面 | `PRODUCT_LIST` のまま。pan / tap / pinch / 2本指上下 / Bubble / 独自 overlay が可能 |

全体 `AD_IDLE` 復帰時は **全 monitor の** overlay・選択・Bubble・gesture・カメラをクリアする。

Bubble は **触っているモニターだけ**表示する。4面同時に同じ Bubble を出さない。各 Renderer が自 window の pointer だけで駆動する。

---

## 9. Logo（I）

| 面 | 表示 |
|----|------|
| LIST | **なし**（0820 で LIST 下に出していた場合も、本番仕様では出さない） |
| IMAGE_ZOOM | ボックスロゴ（上部中央。8/20 FB 添付1枚目の位置） |
| Category modal | 同上 |
| 素材 | `content/Logo` |
| インタラクション | 装飾のみ。タップで TOP/AD_IDLE に戻さない |

本番 `TRUNK_DEMO=production` は `content/Logo` を優先し、無ければリポジトリ直下 `Logo/` にフォールバックする。0820 は従来どおりリポジトリ `Logo/`。FB 位置の最終調整は Phase 5。

---

## 10. Category modal（H）

CategoryDrawer の先はプレースホルダ詳細ではなく、**カテゴリ別画像ギャラリーモーダル**。

```text
上部: Box logo / close
中央: 横画像スライド（左右に前後が少し見える）+ pagination dots
下部: title / description
```

画像は当面 LIST と同じ素材プール。将来は category ごとに `imageIds` で分ける（content-schema）。description は未稿でもフィールドは必須相当として空文字を許す。

その monitor だけ LIST を lock。他 monitor は独立。

---

## 11. 8/20 デモ FB のアーキテクチャ反映

体験修正そのものは Phase 5。ここでは **どこに属するか**だけ固定する。

| FB | 所属 |
|----|------|
| ZOOM 小さく+テキスト、白ブチ、ロゴ、透明×、画像外 tap | per-monitor IMAGE_ZOOM overlay |
| 手前 fade/cut、出現 fade in、ノイズ再検討 | 各 Renderer の LIST（クローン世界） |
| 2本指上下 Dolly | 各 Renderer の gesture（pinch と併記） |
| LIST ロゴなし | 共有 UI 方針 |
| Category modal 横スライド | per-monitor CATEGORY_MODAL |
| overlay 中も他面は操作可 | StateCoordinator（グローバル screenState に ZOOM を上げない） |

---

## 12. 未決（アーキテクチャ）

1. 管理モニター除外ルール（サイズ / 手動 display id / 設定ファイル）
2. bounds 不一致時に起動するか、エラーで止めるか
3. `monitor-layout.json` の配置場所（`content/` vs `app` 設定）
4. 体験 Window を OS fullscreen にするか、bounds ぴったりか
5. `cameraState` を Main に同期するか（デバッグ以外は不要の見立て）
6. 広告・ANIMATION の解像度 / bitrate / 4本同時デコード耐性
7. AD_IDLE ループを duration 固定にするか all-ended にするか
8. ANIMATION 終了判定の正（duration vs all-ended vs 長い方）
9. 開発用 2×2 縮小 Window の公式サポート範囲
10. ノイズテクスチャの採用（Phase 5 で再検討。アーキ上は DOM overlay 候補）

---

## 13. 今回やらないこと

Production Phase 0 では実装しない。Shell / 4 Window / 動画 / 4面 LIST / Category modal / ZOOM 修正 / 2本指上下 / schema 実装は対象外。
