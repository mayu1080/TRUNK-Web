# Production Phase 7 report

| 項目 | 内容 |
|------|------|
| 日付 | 2026-09-01 |
| 対象 | 4 画面実機テスト準備・検証 |
| チェック | `cd app` → `npm run build` → `npm run check:production-phase7` |
| この作業 PC | **ディスプレイ 2 面**（どちらも 1920×1080 landscape）。本番 layout の 4×1080×1920 portrait とは不一致 |

関連: [`production-phase6-report.md`](./production-phase6-report.md)

現場持ち込み用: [`phase7-site-preflight.md`](./phase7-site-preflight.md) / [`phase7-site-qa-checklist.md`](./phase7-site-qa-checklist.md) / [`production-runtime-spec.md`](./production-runtime-spec.md)

---

## 判定（先に）

アプリ側の **4 window 契約**（globalScene 同期、localOverlay 独立、ANIMATION skip なし、120 秒 idle、LIST preload）は headless で通っている。

**4 画面実機での見た目・FPS・長時間安定は、この作業 PC では未実施。** いま繋がっているのは横 2 面だけなので、`npm run start:production` すると OS 座標が合わず **primary 上に 4 window を 2×2 タイルする dev fallback** になる。会場サインオフには使えない。

---

## 1. 4 window 起動結果

| 確認 | 結果 |
|------|------|
| コマンド | `npm run start:production`（`TRUNK_DEMO=production`、frameless、初期 **AD_IDLE**） |
| この PC で起動したか | **していない**。既に `electron.exe .` が 1 renderer（preview 相当）で動いていたため、上書き起動しなかった |
| headless | overlay / Phase 2 / Phase 7 配置シミュレーション **ok** |
| 4 window が開くこと | layout 一致時・不一致時とも **4 本**（一致 / 4 面 OS 順 / 1–3 面 fallback） |

実機では起動ログの `loaded monitor layout` と `fatalOnBoundsMismatch result` を見る。`isDevFallback: true` なら 2×2 タイルで、4 面本番配置ではない。

---

## 2. monitor 配置結果

`content/monitor-layout.json`:

| キー | 値 |
|------|-----|
| 4 monitor | x=0 / 1080 / 2160 / 3240、各 **1080×1920 portrait** |
| `boundsTolerancePx` | **8** |
| `fatalOnBoundsMismatch` | **false**（不一致でも落とさない） |

この PC の OS:

| # | bounds | 向き |
|---|--------|------|
| 1 primary | 0,0 **1920×1080** | landscape |
| 2 | 1920,0 **1920×1080** | landscape |

配置ロジック（`resolveWindowPlacement`）:

| OS | 結果 |
|----|------|
| layout どおり 4×1080×1920 | `boundsMismatch=false`、各 window をその display へ |
| **この PC（2×1920×1080）** | mismatch → **dev fallback**（primary に 4 タイル）。quit しない |
| 4 面あるがサイズが違う | mismatch のまま **OS の x,y 順で 4 面に 1:1**。タイルではない |
| `fatalOnBoundsMismatch=true` かつ不一致 | **起動 abort** |

GPU（参考）: NVIDIA GeForce RTX 4060 Ti + Intel Arc 140T。会場の 4 出力がどちらに繋がるかは未確認。

---

## 3. AD_IDLE / ANIMATION

headless（`check:production-phase2`）:

- 起動 `AD_IDLE`
- どの monitor の `AD_IDLE_TOUCH` でも 4 面 `ANIMATION`
- ANIMATION 中の touch は **throw**（skip しない）
- `ANIMATION_COMPLETE`（mp4 `ended` / safety cap）→ 4 面 `PRODUCT_LIST`
- `animation.json` は 4 track とも `LogoMotion_Trunk.mp4`、`skipOnTouch` は実行時 false

コード: LIST は `ANIMATION` から mount（`list-stage is-preload`）。preload は ANIMATION 中も続く。

実機での mp4 同期再生・終了タイミングは未視聴。

---

## 4. LIST 表示結果

コード / Phase 6 接続:

- ソース `content/images/list/`、53 PNG → 表示 96、seed 1234
- 4 window は **同じ seed** なので抽出・初期配置は揃う
- pan / dolly / bubble は各 renderer 独立

この PC の 2×2 タイルでは「4 面に破綻なく並ぶ」は確認できない（window が小さい）。

---

## 5. 各 monitor 独立操作

headless overlay check:

- M1 IMAGE_ZOOM → M2–M4 は LIST のまま
- M2 Drawer と M3 Modal を同時に開け、M4 は free
- M1 close は M1 だけ。M2/M3 は残る
- グローバル `AD_IDLE` で **全 overlay クリア**

実機タップは未実施。

---

## 6. Image_ZOOM

コード:

- `OPEN_IMAGE_ZOOM` はその monitor のみ
- copy は `content/text/TOKYO FOOD.txt`
- close → `CLOSE_OVERLAY` → LIST
- `overlayOpen` で背面 LIST 操作を止める

実機は未実施。

---

## 7. CategoryDrawer / Category modal

コード:

- hamburger / カテゴリ選択はその monitor のみ
- Food 順: hyoshi → yamabuki / akari / jyunpaku / wakakusa / gen / byakuroku → Option（JSON + コース別 cover）
- swipe / loop あり、**dots なし**
- description は `pre-line` + 欄内だけ `stopScrollLeak`（pointer/wheel が背面 LIST に漏れない）

実機は未実施。

---

## 8. 120 秒 Non-Touch

| 項目 | 実装 |
|------|------|
| 秒数 | `PRODUCTION_SHELL_IDLE_TIMEOUT_SECONDS = 120` |
| 範囲 | 4 面共通。1 面でも `REPORT_TOUCH_ACTIVITY` があればリセット |
| 復帰 | `GLOBAL_IDLE_TIMEOUT` → `AD_IDLE`、全 overlay / selected クリア（`setGlobalScene` が per-monitor を初期化） |
| AD_IDLE / ANIMATION | idle は **arm しない**（Phase 2） |

実機で 120 秒時計合わせは未実施。

---

## 9. FPS / CPU / GPU / Memory

**4 window 本番負荷は未計測。**

参考（この PC で動いていた **1 renderer** の Electron）:

| 項目 | 値 |
|------|-----|
| プロセス | main + gpu + network + **renderer 1**（4 window ではない） |
| Working set 合計 | 約 **970 MB** |
| GPU | RTX 4060 Ti 約 4 GB VRAM 報告。4 面 LIST の実使用は未取得 |

Debug（`D`）に `fps` / `textureLoaded` / `preloadDurationMs` がある。実機では 4 面それぞれを見る。

長時間放置も未実施。

---

## 10. 発見した不具合 / ギャップ

1. **この PC は 4 面 portrait ではない。** `start:production` すると 2×2 fallback。会場確認と混同しないこと
2. 作業中の Electron は **renderer 1 本**。4 window 起動ではなかった
3. `fatalOnBoundsMismatch` が false のため、会場で座標がズレても **静かにタイル / OS 順配置** になる。ログを見ないと気づきにくい
4. content: `Option.png` なし、`byakuroku` フォルダ空。4 面テストはできるが Food modal は表紙欠ける
5. Debug 文言 `listStats: (not mounted — AD_IDLE / ANIMATION)` は、ANIMATION 中に stats がまだ無いときの表示。preload 自体は mount する

コード上の overlay 独立性・skip 禁止・idle クリアに、headless で落ちるものはなかった。

---

## 11. Phase 8 の前に直す / 確認する項目

**必須（実機）**

1. 会場の 4 出力を **1080×1920 portrait** にし、座標を `monitor-layout.json` に合わせる（または JSON を会場に合わせる）
2. その PC で `npm run start:production`。ログが `monitor layout matched 4 display(s)` であること（`dev fallback` が出ないこと）
3. 4 面で AD_IDLE → ANIMATION（skip なし）→ LIST、overlay 独立、120 秒 idle を目視
4. 4 面 LIST の FPS / カクつき / メモリを Debug と OS で記録。長時間 1 周

**任意（content / 運用）**

- 座標が固まったら `fatalOnBoundsMismatch: true` を検討（ズレたら起動しない）
- `Option.png` / `byakuroku` 料理写真
- installer / 遠隔更新は Phase 7 対象外のまま

---

## 実機オペレーター向け手順

```powershell
cd app
npm run build
npm run build:production
npm run check:production-phase7
npm run start:production
```

起動直後の Main ログ:

- `loaded monitor layout` … json パスと 4 id
- `bounds mismatch warning` が **無い**こと
- `fatalOnBoundsMismatch result` … `boundsMismatch: false` `isDevFallback: false`
- `loaded video playlists` … `animationFound: 4`

確認順: AD_IDLE touch → ANIMATION 最後まで → LIST 4 面 → 1 面だけ ZOOM / Drawer / modal → 他面 LIST → 120 秒放置。

1 面確認だけなら従来どおり `npm run start:production:preview`（LIST 直行）。4 面の見た目確認を 1 ディスプレイでやるなら `preview:multi`（本番配置ではない）。
