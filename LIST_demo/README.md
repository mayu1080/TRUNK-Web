# LIST_demo

`PRODUCT_LIST` 描画方式の検討・簡易デモ用ワークスペース。

**Git 管理外**（`.gitignore` 登録済み）。本番リポジトリを煩雑にせず、試作と分析だけをここに集約する。

## フォルダ構成

```text
LIST_demo/
├── README.md           # 本ファイル
├── reports/            # 調査・比較・方針ドキュメント
│   ├── product-list-demo-strategy.md
│   └── product-list-demo-strategy.json
└── demos/              # 簡易デモ実装
    ├── DB-pixi-core/     # Pixi 探索コア
    ├── DA-dom-motion-ui/ # DOM + Motion UI
    ├── DD-pixi-three-style/ # Pixi + Three風 + DOM (E)
    ├── DE-pixi-camera-depth/ # Camera Depth Navigation (E-2) — DD ソース共有・5176
    ├── DF-three-camera-depth/ # Three.js Camera Depth · 5177
    └── DI-three-bubble-reveal/ # Three + Bubble Color Reveal · 5178
```

## 方針（要約）

- 最終方式は**未決定**
- 本番コード（`app/`）・content 読み込みレイヤー・`screen-flow` には手を入れない
- 探索は WebGL **1 canvas** 原則（Pixi + Three 本格併用は避ける）
- UI は **DOM + Motion** で重ねる
- 本番有力候補: **D案**（Pixi + Three風演出 + DOM + Motion）
- 判断材料として **DB（Pixi 探索コア）を最優先**
- 初期デモでは**音なし**（描画・タッチ・FPS・安定性を優先）

詳細は `reports/product-list-demo-strategy.md` を参照。

## デモの役割

| ID | 役割 | 優先 |
|----|------|------|
| **DB** | 社内検証。大量画像・パン・ピンチ・タップ・assetIndex・性能 | **最優先** |
| **DA** | UI確認。drawer・IMAGE_ZOOM・白カード・遷移演出（DBと並行可） | ◎ |
| **DD** | 先方レビュー候補。見た目・世界観・CULTISH 5翻訳 | ◎ |
| **DC** | 表現上限確認。Three.js軽量スパイク（実施推奨・本番第一候補ではない） | 推奨 |
| **DE** | 補助素材検証。Unity/TDをLIST本体ではなく素材制作に | 必要時のみ |

## 推奨進行順

1. **DB** — Pixi 探索コア（最優先）
2. **DA** — DOM + Motion UI（DBと並行可）
3. **DD** — DBコア流用 + CULTISH 翻訳演出
4. **DC** — Three.js 軽量スパイク（DDチューニングの参照）
5. **DE** — 必要時のみ

## 合否基準（抜粋）

- 70枚・1台 55fps+
- 4面30分・クラッシュ / Context Lost なし
- タップ誤判定少・パン/ピンチ破綻なし
- ZOOM / drawer 時に LIST 操作が暴発しない
- `assetIndex` + `getContentFileUrl` 接続・content 差し替え対応
- 終了時 texture / listener 適切に破棄

全文は `reports/product-list-demo-strategy.md` §合否基準 を参照。

## デモ共通キーボード（維持すること）

LIST デモではレビュー用 UI と社内デバッグ UI を切り替える。**以降のデモでも削除しない。**

| キー | 動作 |
|------|------|
| **G** または **D** | review ↔ debug トグル |
| **R** | review モードに戻す |

- **review**: バナー・デバッグパネル・トグル非表示（先方レビュー用）
- **debug**: FPS・プリセット・トーンプリセット・ヒットテスト等の検証 UI 表示

現状 **DD**（ポート 5175）で実装。DB / DA にも同様のショートカットを揃える想定。

## デモの起動

DB と DA は **別ポート** で同時起動できます（混同しないこと）。

| デモ | コマンド | URL |
|------|----------|-----|
| **DB** Pixi 探索コア | `cd LIST_demo && npm run demo:db` | http://localhost:5173 |
| **DA** DOM + Motion UI | `cd LIST_demo && npm run demo:da` | http://localhost:5174 |
| **DD** Pixi + Three風 + DOM (E) | `cd LIST_demo && npm run demo:dd` | **http://localhost:5175** |
| **DE** Camera Depth (E-2) | `cd LIST_demo && npm run demo:de` | **http://localhost:5176** |
| **DF** Three.js Camera Depth | `cd LIST_demo && npm run demo:df` | **http://localhost:5177** |
| **DI** Three Bubble Reveal | `cd LIST_demo && npm run demo:di` | **http://localhost:5178** |

各デモフォルダ内からも `npm run dev` / `npm run demo:db` / `npm run demo:da` で起動可能。詳細は各デモの README を参照。

## 関連（リポジトリ内）

- `docs/architecture.md` — 本番アーキテクチャ（LIST 描画方式は未決）
- `docs/screen-flow.json` — 画面遷移の正
- `content/` — 外部素材（デモは既存 API から読むのみ）
