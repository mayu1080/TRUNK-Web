# Production Implementation Plan

| 項目 | 内容 |
|------|------|
| 版 | 0.1 |
| 日付 | 2026-08-29 |
| フェーズ | Production Phase 0 完了後の実装順（本書は計画のみ） |
| 機械可読版 | [`production-implementation-plan.json`](./production-implementation-plan.json) |

前提: 8/20 `demo-0820` を体験核として再構成する。LIST_demo を本番へ丸コピーしない。Phase 0 ではコードを変更しない。

---

## 0. 全体方針

- グローバルシーンと per-monitor overlay を先に正しく切る（Phase 1）
- 動画と 120秒を載せてから LIST を4面にする（Phase 2 → 3）
- overlay 独立性を満たしてから UX FB（白ブチ・フェード・2本指縦）を入れる（Phase 4 → 5）
- schema・現場運用・長時間は後ろ（Phase 6 → 7）

`demo-0820-color` は本番パスの対象外でもよい。本番 Renderer は **本体 0820（白黒 + Bubble）系統**を第一候補とする（未決: color をプリセットにするか）。

---

## Phase 1: App Shell / 4 Windows / StateCoordinator

**次に実装すべき範囲（Phase 0 完了後の着手単位）。**

Phase 1 実装入口: `app` で `npm run start:production`（`TRUNK_DEMO=production`）。`demo-0820` は別コマンドのまま。

| 含める | 含めない |
|--------|----------|
| 4 BrowserWindow | 広告・ANIMATION 動画の本再生 |
| `monitor-layout.json` 読み・bounds 照合（tolerance） | Three LIST の4面世界 |
| `globalScene` + `perMonitorState` | IMAGE_ZOOM UI 改修 |
| 管理モニター除外の第一実装 | Category modal |
| Debug / 構造化ログ | 120秒本番値での現場運用テスト |
| 開発用 2×2 縮小 Window | content schema の動画必須化 |

成果物イメージ:

- Main: `GlobalScene` が 4 window で揃う
- overlay を変えても他 window の `interactionEnabled` が落ちないことを、仮 UI（色面でも可）で確認
- `monitorId` が各面の HUD に出る

合格: 4 window が layout どおりに出る。グローバル遷移の箱だけ動く。LIST はプレースホルダでよい。

---

## Phase 2: AD_IDLE / ANIMATION / 120sec reset

**実装済（2026-08-29）。** 入口は Phase 1 と同じ `npm run start:production`。動画欠落は placeholder + warn（`fatalIfMissing` 既定 false）。packaged idle は 120秒。dev は `TRUNK_PRODUCTION_IDLE_SECONDS`（なければ `TRUNK_IDLE_TIMEOUT_SECONDS`、なければ 20秒）。0820 の 600秒は変更しない。

素材: `content/ads.json` + `ads/monitor-N.mp4`（候補 C + 規約パス）。ANIMATION 終了は **duration**。`skipOnTouch` は runtime 常に false。

| 含める | 含めない |
|--------|----------|
| アプリ内広告 4本再生（B案） | 外部 Player（A案）実装 |
| AD_IDLE の any-monitor touch → 4面 ANIMATION | LIST 本描画 / Bubble / Dolly |
| ANIMATION touch 無視 | skip ボタン |
| アプリ内 animation 4本 + 終了 → 4面 LIST 入場（入場先はプレースホルダ可） | IMAGE_ZOOM 本 UI / Category modal / UX FB |
| 120秒全体 Non-Touch → 全面 AD_IDLE | per-monitor 10分 idle の維持 |
| 復帰時の全 local クリア | |

`TouchActivityManager` を Main に置く。reset / 非 reset の区別をテストする。

合格: 1面 touch で4面が広告→演出→探索箱へ。演出中 touch で進まない。探索箱で無操作120秒（開発は短い秒に上書き）で全面広告に戻る。

---

## Phase 3: 4-screen PRODUCT_LIST

**実装済（2026-08-29）。** 各 BrowserWindow が独立した ExploreController クローン。shared seed / dataset / layout。per-monitor camera / pan / dolly / Bubble。overlay 本 UI は Phase 4。

| 含める | 含めない |
|--------|----------|
| shared seed / dataset / 初期配置 | overlay 本実装（ZOOM は 0820 相当の仮で可） |
| per-monitor viewport offset | UX FB（fade/cut、ノイズ、白ブチ） |
| per-monitor camera / dolly / Bubble | 2本指上下（Phase 5 でも可。pinch は 0820 移植をこの Phase で載せる） |
| content 画像 | |
| 4 monitor 見た目チェック（入場時に1空間に見えるか） | |

クローン世界。共有シミュレーションにしない。

合格: 4面同時に LIST。各面独立 pan / pinch dolly / Bubble。1面を触っても他面のカメラが動かない。

---

## Phase 3.5: content 画像投入ルール / validation

**実装済。** LIST UI は触らない。`docs/production/production-content-intake.md` と `npm run check:production-content`。サイズ・ファイル名は warning のみ（非 fatal）。

---

## Phase 4: Local overlays

**実装済（2026-08-29）。** per-monitor IMAGE_ZOOM / CategoryDrawer / Category modal。0820 相当の骨格。FB 見た目（白ブチ・透明×位置・near fade 等）は Phase 5。

`npm run check:production-phase4`

合格:

- 面1 ZOOM 中に面2〜4が LIST を触れる
- 面2 Drawer 中に他面が触れる
- 当該面だけ lock / Bubble 停止
- 全体 idle で全 overlay が消える

---

## Phase 5: UX Feedback implementation（8/20 FB）

**実装済（2026-08-30）。** globalScene / localOverlay / 120秒 / content validation は未変更。

`npm run check:production-phase5`（独立性 + FB マーカー + flower 1枚）。

| FB | 内容 |
|----|------|
| IMAGE_ZOOM | 小さめ画像 + 白ブチ + テキスト、画像外 tap、画像下透明×、右上×、Box logo |
| LIST | 手前 fade out → cut、wrap 後 appear fade in、薄い DOM ノイズ |
| Touch | 2本指上下なぞり → Dolly Cruise。pinch と優勢1入力。上=潜る |
| Logo | LIST なし。ZOOM / modal は `content/Logo` |
| Category modal | 左右 peek、フリック、1枚（flower）でも破綻しない |

合格: デモ FB 項目が仕様どおり。他面独立を壊さない。

---

## Phase 5.5: Production-size preview / LIST preload / noise mp4 / small UX

**実装済（2026-08-30）。** Phase 6 には入らない。独立性 / 120秒 / content validation は未変更。

日常の UI 確認: `npm run start:production:preview`（1 window）  
4window 状態確認: `npm run start:production:preview:multi`  
本番相当: `npm run start:production`  
`npm run check:production-phase55`

| 含める | 含めない |
|--------|----------|
| 1 window の 1080×1920 preview（既定）。4 window preview は `:multi` | monitor-layout.json の本番照合の変更 |
| ANIMATION 中 LIST preload。入場時に loading 文言を出さない | IMAGE_ZOOM / Category modal の大幅デザイン変更 |
| `content/noise` mp4（無ければ DOM fallback） | content 全差し替え |
| Drawer × 削除（scrim close）/ modal 循環 / logo 白地 | 4面 LIST 配置の根本変更 |

AD_IDLE では Three を破棄。ANIMATION で mount / preload。LIST 入場は同じインスタンスを継続。

---

## Phase 5.7: UX修正パス1（LIST / IMAGE_ZOOM card / Drawer / chrome）

**実装済（2026-08-30）。** Category modal の本格デザインは含まない。独立性 / 120秒 / content validation は未変更。

日常確認: `npm run start:production:preview`（既定 review）  
`npm run check:production-phase57`

| 含める | 含めない |
|--------|----------|
| review/debug chrome 切替。本番 frameless | Category modal カード化 |
| loading 文言禁止 + LIST 入場 hold | image-details.json 本読込 |
| near fade 460 / cut 90 + near scale | 4面同期変更 |
| preview 初期値（punchy / bubble 160 / motion off） | demo-0820 |
| noise 0.14、IMAGE_ZOOM 白カード + LOGO_TEXT | 本番画像全差し替え |

詳細: [`production-phase57-report.md`](./production-phase57-report.md)。画像テキスト: [`production-image-copy.md`](./production-image-copy.md)。

---

## Phase 5.8: LIST fade / density / IMAGE_ZOOM バランス / Drawer motion

**実装済（2026-08-30）。** Category modal の本格デザインは含まない。独立性 / 120秒 / content validation は未変更。

日常確認: `npm run start:production:preview`（既定 review + frameless）  
title bar が必要なら `TRUNK_PRODUCTION_PREVIEW_FRAME=1`  
`npm run check:production-phase58`

| 含める | 含めない |
|--------|----------|
| preview 既定 frameless。本番は常に frameless | Category modal カード化 |
| near fade 720 / cut 260 + near scale 880 / 0.28 | image-details.json 本読込 |
| visual clean、bubble 160/80/off、noise 0.20 | 4面同期変更 |
| density dense-96（96枚 + world 詰め） | demo-0820 |
| IMAGE_ZOOM 固定カード + LOGO_TEXT 拡大 + 細い× | 本番画像全差し替え |
| Drawer 0820 CSS motion（260/230ms） | |

詳細: [`production-phase58-report.md`](./production-phase58-report.md)。

---

## Phase 5.9: 体感確認に基づく fade / speed / IMAGE_ZOOM motion

**実装済（2026-08-30）。** CategoryDrawer / Category modal 本格デザインは触らない。独立性 / 120秒 / content validation は未変更。

日常確認: `npm run start:production:preview`（LIST 直行）  
AD / ANIMATION 確認: `preview:multi` または single でキー `1` / `2`  
`npm run check:production-phase59`

| 含める | 含めない |
|--------|----------|
| preview 初期シーン仕様の明記 | CategoryDrawer 変更 |
| near fade 1180 / cut 520 + scale 1360 / 0.20 | Category modal カード化 |
| list speed 2.6 | 4面同期変更 |
| LOGO_TEXT clamp(64px, 8vh, 120px) | demo-0820 |
| IMAGE_ZOOM CSS open/close ease | 本番画像差し替え |

詳細: [`production-phase59-report.md`](./production-phase59-report.md)。

---

## Phase 5.10: near fade alpha-only / LOGO_TEXT 2.5x / IMAGE_ZOOM motion短縮

**実装済（2026-08-30）。** CategoryDrawer / Category modal は触らない。独立性 / 120秒 / content validation は未変更。

`npm run check:production-phase510`

| 含める | 含めない |
|--------|----------|
| near fade は alpha のみ。shrink-to-disappear 廃止 | CategoryDrawer |
| 見かけサイズ clamp（maxApparentScaleDist 1180） | Category modal カード化 |
| LOGO_TEXT CSS 2.5x + 余白クリップ | demo-0820 |
| IMAGE_ZOOM open 180 / close 150 / scrim 150 | 4面同期 |

詳細: [`production-phase510-report.md`](./production-phase510-report.md)。

---

## Phase 5.11: near fade を手前から / IMAGE_ZOOM close 余韻

**実装済（2026-08-30）。** 画像の加速度（sceneDrift / list speed）は未変更。CategoryDrawer は触らない。

`npm run check:production-phase511`

| 含める | 含めない |
|--------|----------|
| near fade 1760 → 960、線形 alpha | drift / list speed 変更 |
| IMAGE_ZOOM close 180 / open 200 / scrim 170 | CategoryDrawer |
| | Category modal カード化 |

詳細: [`production-phase511-report.md`](./production-phase511-report.md)。

---

## Phase 6: Content / Operation

- 本番 content schema 実装と起動時検証
- ads / animation / Logo / categories.imageIds
- 差し替え手順、transfer / launch notes
- ログ、欠落時の recovery メッセージ
- 現行 `Logo/` から `content/Logo` への移行

---

## Phase 7: Long-run / On-site test

- 4画面長時間
- 120秒復帰（全体）
- 複数人同時（最大4グループ）
- FPS、Context Lost
- WinTouch（pinch + 縦2本指、隣接面同時）
- 運用（起動、素材差し替え、管理モニター非干渉）

---

## 依存関係

```text
Phase 1 ─► Phase 2 ─► Phase 3 ─► Phase 4 ─► Phase 5
                              │
                              └──────────► Phase 6（schema は 2〜4 と並行ドラフト可、締めるのは 6）
Phase 5 + 6 ─► Phase 7
```

Phase 5 を Phase 4 より前にやると、ZOOM をグローバル状態のまま作り直す無駄が出る。独立性を先に固定する。

---

## 8/20 からの持ち込み

| 資産 | 持ち込み先 |
|------|------------|
| `ExploreController` / sceneLayout / Dolly Cruise | Phase 3（インスタンスを window ごと） |
| Bubble overlay + reveal shader | Phase 3 |
| CategoryDrawer Frozen（幅は要確認） | Phase 4 |
| ImageZoomOverlay | Phase 4 骨格 → Phase 5 見た目 |
| `getContentFileUrl` / exploreImages | Phase 3 / 6 |
| 1 window 起動・`TRUNK_DEMO=0820` | 開発用に残してよい。本番パスとは分離 |

---

## リスク

| リスク | 見る Phase |
|--------|------------|
| 4本動画同時デコード | 2, 7 |
| フォーカス / kiosk | 1, 7 |
| クローン世界のメモリ×4 | 3, 7 |
| overlay IPC の誤 broadcast | 1, 4 |
| 2本指縦と pinch の競合 | 5, 7 |
| layout 照合失敗（5枚目管理モニタ） | 1, 7 |

---

## Phase 0 でやらないこと（再掲）

本番 Shell / 4 Window / 動画 / 4面 LIST / Category modal / IMAGE_ZOOM 修正 / 2本指上下 / content schema の実装は、各 Phase まで行わない。
