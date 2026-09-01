# DE vs DF 比較レポート

| 項目 | 内容 |
|------|------|
| 版 | 1.0 |
| 作成日 | 2026-07-11 |
| 対象 | DE（Pixi camera depth） / DF（Three.js camera depth） |
| 目的 | DI（Bubble 統合）選定・引き継ぎ用の短い体感比較 |
| 詳細 | DF 実装は [`DF-three-camera-depth-implementation-report.md`](./DF-three-camera-depth-implementation-report.md) |

> 体感は主観を含む。DE は Hit 判定修正（座標 resolution / tap 閾値緩和 / alpha 0.08）後の前提で書く。

---

## 早見表

| 比較項目 | DE | DF | 所感 |
|----------|----|----|------|
| **カメラ感** | Pixi 疑似カメラ + perspective 風スケール。空間感はあるが「2.5D」 | 本物の PerspectiveCamera + fog。入っていく感覚が強い | **DF 優勢** |
| **操作感** | pan / wheel timeScale（Shift ブースト）。ぬるさは調整済み | drag XY + wheel Z + Shift dolly cruise（慣性・FOV breathe）。ぬるぬる | **DF 優勢** |
| **Hit 判定** | pointerup 手動 AABB。修正前は激渋。修正後は改善想定だが実装が重い | Raycaster + distance 最小。比較的快適 | **DF が素直**（DE は修正で追い上げ） |
| **FPS** | Pixi + BlurFilter 等。60 枚前後 | Three Plane 70 枚。通常は十分 | 環境依存。大きく差がなければ同等扱い |
| **実装複雑度** | DD 共有コードに mode 分岐。Pixi 座標・bounds・overlay が絡む | デモ独立。Three 一本だがファイルは一式コピー | DE=共有メンテ負荷 / DF=独立コピー向き |
| **本番リスク** | Pixi 既存知見に近いが疑似3Dの限界 | Three 導入コスト・バンドル。本物3Dは体験上限が高い | 体験優先なら DF 系、既存 Pixi 寄せなら DE 系 |
| **クライアント満足度** | 良いが「疑似」感が残る場合あり | ぬるぬる・空間感で満足度が高い印象 | **DF が高い** |
| **採用候補** | Hit 修正後の Pixi 路線検証用として価値あり | **Bubble 統合（DI）のベースとして第一候補** | DI は DF コピー推奨 |

---

## 体感メモ（現状）

- **DF はぬるぬる動く**（smoothing + cruise 慣性）
- **DF の方が満足度が高い**（カメラ感・dolly）
- **DE は Hit が渋かった**（修正前: resolution 未除算、didPan 誤拒否、alpha 厳しめ）。修正後は改善するが、Raycaster の素直さは DF が有利
- DE の強み: DD とのコード共有、Pixi フィルタ演出の延長
- DF の弱み: tap 12px/500ms・alpha 0.18 はやや厳しめ、テクスチャ逐次ロード、billboard なし

---

## 数値ざっくり

| | DE | DF |
|---|----|----|
| ポート | 5176 | 5177 |
| 枚数 | ~60 | ~70 |
| Hit | transform AABB | Raycaster |
| Hit alpha 下限 | 0.08（修正後） | 0.18 |
| Tap move / dur | 18px / 650ms | 12px / 500ms |
| Shift+wheel | timeScale | camera velocity cruise |

---

## DI への示唆

1. **ベースは DF をコピーして DI を作る**（DF 本体は触らない）
2. Bubble は Three 上のカラー復帰設計が必要（Test_TRUNK の DOM clip-path は参照のみ）
3. DE は Pixi 路線の比較・保険として残す。DI の主戦場にはしない

---

## 結論

クライアント見せ・空間体験・Hit の素直さでは **DF が現状の第一候補**。  
DE は Hit 修正で操作の信頼性は上がるが、「ぬるぬる空間」の満足度では DF が勝りやすい。  
`DI-three-bubble-reveal` は **DF コピー起点**が妥当。
