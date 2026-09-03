# Production Touch Gestures

| 項目 | 内容 |
|------|------|
| 版 | 0.1 |
| 日付 | 2026-08-29 |
| フェーズ | Production Phase 0（設計のみ） |
| 機械可読版 | [`production-touch-gestures.json`](./production-touch-gestures.json) |

関連: [`production-state-flow.md`](./production-state-flow.md) / 8/20 `exploreController.ts`（pinch dolly） / [`docs/0820-demo/dolly-cruise-port-notes.md`](../0820-demo/dolly-cruise-port-notes.md)

---

## 0. 方針

ジェスチャの質感は **8/20 で成立した Dolly Cruise / 1本指 pan / tap→ZOOM** を正とする。本番追加は次のみ。

- 2本指上下なぞり → 同じ Dolly Cruise 経路
- 4面では **当該モニターのカメラだけ**動かす
- overlay ロックは **当該モニターだけ**
- 有効操作だけが 120秒タイマーを reset する

WinTouch を主入力とする。`pointer*` を第一実装。`touchstart` は reset の補助契機。

---

## 1. AD_IDLE（3-1）

| 入力 | 結果 |
|------|------|
| どのモニターでも、1本指以上の touch（`pointerdown` / `touchstart`） | `globalScene = ANIMATION`（4面同期） |

本数・位置・ヒット領域は問わない（全面ヒット）。ドラッグ量は不要。down した時点で発火。

複数面が同時に触っても ANIMATION は一度だけ開始する（idempotent）。

Bubble は出さない（まだ LIST ではない）。

---

## 2. ANIMATION（3-2）

| 入力 | 結果 |
|------|------|
| 任意の touch / pinch / tap | **無視**。skip しない。PRODUCT_LIST へ早送りしない |

ログしてよい。タイマーもシーンも動かさない。

---

## 3. PRODUCT_LIST（3-3）当該モニター、`localOverlay=NONE`

操作対象は常に **その BrowserWindow のクローン世界**。他面のカメラを動かさない。

### 3.1 1本指 tap

- 画像ヒット → 当該面 `IMAGE_ZOOM`
- ミスヒット → 何もしない（タイマーは pointerdown で既に reset してよい）

閾値は 0820 初期値を継承候補とする: 移動 16px 以内、600ms 以内、カード alpha 下限あり。実機で再調整可。

### 3.2 1本指 drag

- 当該面 LIST の **pan**（カメラ X/Y）
- drag 開始で 120秒 reset
- 2本指セッション中は 1本指 pan しない（0820 と同じ）

### 3.3 2本指 pinch in / out

- 当該面 **Dolly Cruise**（0820 `applyDollyImpulse(..., 'pinch')` と同系統）
- pinch out（距離増）→ 潜る方向（0820 と同じ符号）
- pinch in → 引く
- 2本中は pan しない。up 時 tap しない
- 離したあとは `releaseBrake` で余韻

### 3.4 2本指上下なぞり（0820 に無い本番追加）

- 当該面 **同じ Dolly Cruise** 経路
- 2点の距離変化ではなく、**2点重心の Y 移動**を impulse にする
- ピンチと同時に発生しうる。第一候補: 両方を加算せず、**優勢入力を1つ**取る

優勢の第一候補:

1. フレーム内で `|Δdistance|` が縦移動より大きければ pinch
2. それ以外で `|ΔcentroidY|` が閾値超なら vertical dolly
3. 閾値未満は無視（jitter）

符号の第一候補（未決。実装前に確認）: **上へなぞる = 潜る（0820 Shift 上方向と同じ）**。

### 3.5 Bubble

- **触っているモニターだけ**表示
- 他面に複製しない
- overlay 中・ANIMATION・AD_IDLE では出さない（LIST かつ `NONE` のみ）
- Bubble の追従 move だけでは 120秒を reset しない。接触開始（down）は reset する

### 3.6 hamburger

- 当該面だけ `CATEGORY_DRAWER` を開く
- 位置・見た目は 0820 / DI Frozen を大枠継承（幅は 0820 で画面 1/3 になった点を本番でも踏襲するかは Phase 4 で確認）

### 3.7 wheel / Shift+wheel

現場はタッチ主。開発用に 0820 の wheel / Shift+wheel / trackpad pinch（ctrl+wheel）を残してよい。本番キオスクでマウスは必須ではない。

---

## 4. Overlay 中（3-4）

対象: 当該 monitor の `IMAGE_ZOOM` / `CATEGORY_DRAWER` / `CATEGORY_MODAL`。

| 面 | LIST pan / dolly / tap / Bubble |
|----|----------------------------------|
| overlay を出している monitor | **止める**（`interactionLocked`） |
| 他 monitor | **止めない** |

### 4.1 IMAGE_ZOOM（当該面）

| 入力 | 結果 |
|------|------|
| 画像外 tap（バックドロップ） | close → `NONE` |
| 画像下の透明 × | close |
| 右上 ×（添付1枚目） | close |
| 画像上の横スワイプ | **ZOOM では横ギャラリーにしない**（Category modal 側の機能） |
| 背面 LIST へのジェスチャ | 届かない |

Box logo は装飾。タップしても閉じない／AD_IDLE に戻さない。

### 4.2 CategoryDrawer（当該面）

| 入力 | 結果 |
|------|------|
| hamburger × / scrim | close → `NONE` |
| カテゴリ項目 tap | `CATEGORY_MODAL`（Drawer は閉じる） |
| 背面 LIST | 無効 |

### 4.3 Category modal（当該面）

| 入力 | 結果 |
|------|------|
| × | close → `NONE`（LIST lock 解除） |
| 横スワイプ / フリック | 同一カテゴリ内の画像スライド |
| pagination dots tap | 当該 index へ |
| Box logo | 装飾のみ |

close は LIST へ。Drawer は開き直さない。

---

## 5. 120秒タイマーとの対応

| ジェスチャ | reset |
|------------|:-----:|
| AD_IDLE の touch | 対象外（入場） |
| ANIMATION の touch | しない |
| LIST pointerdown / drag 開始 / pinch 開始 / 2本指縦開始 | する |
| tap 成立・ミスヒット（down 済み） | down で済み |
| hamburger open/close、select、zoom open/close、modal close | する |
| pointermove のみ、Bubble 追従のみ | **しない** |

Main へは「有効操作があった」ことだけ送ればよい。座標は不要。

---

## 6. 4面同時操作

最大4グループが別モニターを同時に触る。

- 各 window の Pointer capture は OS / Electron がディスプレイ単位で配る前提
- ある面の 2本指が、別面の 1本指と混線しないこと（window が display に分かれていれば通常は混線しない）
- 検証項目（Phase 7）: 隣接面の同時 pinch、同時 ZOOM、1面 overlay + 他面 dolly

---

## 7. 未決（ジェスチャ）

1. 2本指上下の符号（上=潜るか引くか）
2. pinch と縦なぞりの同時時の優勢ルール確定
3. 縦なぞりの死帯（px）
4. Category modal のスワイプ感度・ループの有無
5. ZOOM を pinch で閉じるか（仕様上は閉じない。画像外 tap と × のみ）
6. Frozen Drawer 幅 320 vs 0820 の `100vw/3` の本番採用値
