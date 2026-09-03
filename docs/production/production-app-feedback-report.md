# アプリ FB レポート（1回目運用以降）

| 項目 | 内容 |
|------|------|
| 日付 | 2026-08-31 |
| 対象 | `TRUNK_DEMO=production` |
| 位置づけ | 1回目運用のあとで見る更新メモ。いまの実装範囲外 |

`globalScene` / `localOverlay` / overlay independence / 120秒 Non-Touch は維持。

---

## 今後の更新事項

### 1. Gift / Flower の Category modal にも cover を挟む

いまは **Food だけ** `images/cover/` をフォルダ境界に挟む。

Gift / Flower は `categories.json` に `contentFolders` を書いてあるが、`insertCoverBetweenFolders` は `false`。

次に挟むときは:

- Gift / Flower の flag を `true` にする
- 必要ならカテゴリ別 cover を分ける（いまの cover は TOKYO FOOD 1 枚）
- dots なし（Category modal 全体で非表示）・swipe あり・ループに含める、は Food と同じでよい想定

### 2. Category modal のコース別テキスト

いまは IMAGE_ZOOM も Category modal も **`content/text/TOKYO FOOD.txt` 1 本**。

そろったらこうしたい:

| スライド | テキスト |
|----------|----------|
| 表紙（cover） | `content/text/TOKYO FOOD.txt` |
| 各コース画像 | そのフォルダ内の `*テキスト.txt`（朱=`AKARIテキスト.txt`、若草=`WAKAKUSAテキスト.txt`、山吹=`YAMABUKIテキスト.txt`、純白=`JYUNPAKUテキスト.txt` など） |

未稿:

- Option / 玄 / 白緑 にコース文がない
- Gift / Flower はフォルダ内 txt があるが、共通 1 本方針のため未接続

コース名（フォルダ名）をテキスト欄の一番上に出す処理は、Food ではすでに入っている。本文だけ差し替えればよい。

### 3. LIST ファイル名の整理

ASCII 化済み（`表紁E` → 該当ファイルは当時 LIST から削除済み、`若草over` → `wakakusa_cover`）。コース表示名は `categories.json` の `contentFolderLabels` に残している。

---

## いま入っているもの（参照）

- LIST: `images/list/` 56 PNG → 表示 96（複製）。seed 1234、配置は起動ごとランダム
- Food carousel: cover → Option → cover → 玄 → cover → 白緑 → cover → 山吹 → cover → 朱 → cover → 純白 → cover → 若草 → ループ。フォルダ内 `*_cover.png` は残す。Category modal に dots なし
- ANIMATION: `LogoMotion_Trunk.mp4` を 4 面同じ再生。`durationMs` 5000
- テキスト: 引用符残す、改行保持、中央揃え。modal は Maison Neue。IMAGE_ZOOM のフォントは変更していない
