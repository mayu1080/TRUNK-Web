# コンテンツ manifest（案）

将来、画像/動画の差し替えを「コード修正なし」でできるようにするための契約（contract）です。

## 方針

- 実装は `assets/manifest.json` を読み込む
- 追加要望で遠隔更新にする場合は、読み込みURLを差し替える

## TODO（L1で決める）

- 必須キー（例: categories / items / media）
- 画像サイズ/比率の規約
- ローカル配置ルール（`assets/images/...`, `assets/video/...`）

