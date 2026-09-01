# Production Phase 5.10 report

| 項目 | 内容 |
|------|------|
| 日付 | 2026-08-30 |
| 対象 | `TRUNK_DEMO=production` |
| 判定 | near fade は alpha のみ。LOGO_TEXT 2.5x。IMAGE_ZOOM motion 短縮 |

## near fade

縮小しながら消える処理を廃止した。

近づく → 見かけサイズを fade 開始時に clamp → **alpha だけ落ちる** → dist `nearFadeEndDist` で完全に消え、カメラより手前には残らない。

| キー | 値 | 使用 |
|------|-----|------|
| nearFadeStartDist | 1180 | 使う |
| nearFadeEndDist | 520 | 使う |
| nearScaleStartDist | 1360 | **使わない** |
| nearScaleMin | 0.2 | **使わない** |
| maxScaleClamp | **1** | world scale 上限 |
| maxApparentScaleDist | **1180** | これより近いと、画面上の大きさが fade 開始時を超えないよう world scale を落とす（見た目は縮まない） |

`nearScaleMin` による shrink-to-disappear はない。max clamp は「画面を覆う巨大化」防止で、fade 区間の見た目サイズはほぼ一定のまま透明化する。

## LOGO_TEXT

CSS 画像高さ: `clamp(160px, 20vh, 300px)`（旧 64 / 8vh / 120 の約 2.5 倍）

**画像側に大きな余白がある。** `content/Logo/LOGO_TEXT.png` は **2351×2351** の正方形。文字は中央の細い帯で、高さの大半は空（透明）余白。contain のまま 2.5 倍しても文字は小さく見える。

対応: 左上スロット `height: clamp(44px, 5.6vh, 76px)` で overflow clip し、2.5 倍した画像の中央（文字帯）を見せる。close ボタンとは `right: 64px` で干渉しない。装飾のみ。

## IMAGE_ZOOM motion

easing は維持: `cubic-bezier(0.32, 0, 0.58, 0.02)`  
translate / scale の形も維持。

| | 5.9 | 5.10 |
|--|-----|------|
| backdrop | 220ms | **150ms** |
| open | 280ms | **180ms** |
| close | 230ms | **150ms** |

CategoryDrawer は 260 / 230 のまま。
