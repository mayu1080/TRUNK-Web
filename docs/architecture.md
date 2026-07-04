# architecture.md（実施設計・草案）

> 本書は外注先が実施設計を作成・更新するためのテンプレートです。
> 確定事項は `docs/screen-flow.json` / `README.md` を正とし、未決は `docs/open-questions.md` を参照してください。

## 1. 目的・スコープ

- 4台タッチモニター向け探索体験の実装アーキテクチャを定義する
- 画面状態・同期範囲・各モニター独立性を実装可能な粒度に落とす

## 2. 確定している仕様（実装前提）

| 項目 | 内容 |
|------|------|
| 機能挙動の正 | `Design_Check0622.mp4`（画質は対象外） |
| screenState | `TOP`, `ANIMATION`, `PRODUCT_LIST`, `IMAGE_ZOOM`, `PRODUCT_DETAIL` |
| CATEGORY | 独立 screenState ではない。`PRODUCT_LIST` + `categoryDrawer: open/closed` |
| IMAGE_ZOOM | `PRODUCT_LIST` 上の白 overlay。`screenState` 独立可。×は常に `PRODUCT_LIST` |
| IMAGE_ZOOM トリガー | `PRODUCT_LIST` 画像タップ |
| TRUNK ロゴ | 装飾のみ。タップハンドラなし |
| 4面同期 | `TOP` → `ANIMATION` → `PRODUCT_LIST` まで |
| TOP → ANIMATION 条件 | **4台すべて `TOP` のときのみ** |
| PRODUCT_LIST 以降 | 各モニター操作は独立 |
| 無操作タイムアウト | 10分。当該モニターのみ `TOP`。タップ・スワイプ・ピンチ・スクロールでカウント再スタート |

## 3. 論点（外注が設計すべき項目）

### 3.1 システム構成

- [ ] 4台 + 同期コントローラ（有無）の構成図
- [ ] プロセス/スレッドモデル（1台1プロセスか、1マシン4ウィンドウか）
- [ ] デプロイ形態（キオスク、自動起動、監視）

### 3.2 状態管理

```text
（案）
{
  screenState: 'TOP' | 'ANIMATION' | 'PRODUCT_LIST' | 'PRODUCT_DETAIL' | 'IMAGE_ZOOM',
  categoryDrawer?: 'open' | 'closed',  // screenState=PRODUCT_LIST 時
  scrollSection?: 'DETAIL_SECTION_1' | 'DETAIL_SECTION_2',
  topPanelIndex?: 1 | 2 | 3 | 4,
  perMonitorState: { ... }  // PRODUCT_LIST 以降はモニター単位
}
```

- [ ] `PRODUCT_LIST` 以降の状態をモニター単位で保持する構造
- [ ] `categoryDrawer` と `screenState` の更新順序・競合

### 3.3 4面同期（TOP → LIST）

- [ ] 同期イベントの種類（tap / animationComplete 等）
- [ ] 同期メッセージ形式・シリアライズ
- [ ] 遅延許容・再送・タイムアウト
- [ ] `PRODUCT_LIST` 到達後に同期チャネルを無効化する境界

### 3.4 描画・性能（60fps / 低遅延）

- [ ] 探索画面（40〜70枚）の描画パイプライン
- [ ] タッチ入力 → 描画更新のレイテンシ目標
- [ ] 計測方法（fps、input latency）

### 3.5 障害・復旧

- [ ] 1台のみ応答しない場合
- [ ] アプリクラッシュ時の自動再起動
- [ ] コンテンツ読み込み失敗時

## 4. 未決事項への参照

| 未決 | 参照 |
|------|------|
| 同期技術方式 | `open-questions.md` Q1 |
| HW / OS | `open-questions.md` Q2 |

## 5. 受入に接続する設計成果物

- [ ] コンポーネント図
- [ ] 同期シーケンス図（TOP → LIST）
- [ ] 状態遷移表（モニター単位含む）
- [ ] 性能試験計画
