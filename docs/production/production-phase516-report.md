# Production Phase 5.16 report

| 項目 | 内容 |
|------|------|
| 日付 | 2026-08-31 |
| 対象 | shared text / Food cover 挟み / ANIMATION 1本4面 |
| チェック | `cd app` → `npm run build` → `npm run check:production-phase516` |

詳細決定は [`production-phase516-content-inventory.md`](./production-phase516-content-inventory.md)。運用後メモは [`production-app-feedback-report.md`](./production-app-feedback-report.md)。

---

## やったこと

- `categories.json` に `contentFolders` を追加。順は JSON 明示（アプリはそれを読む）
- Food だけ `insertCoverBetweenFolders: true`。cover は `images/cover/` の 1 枚を毎回同じ
- フォルダ内 `*_cover.png` は通常スライドとして残す
- Category modal の dots は削除。swipe とループは維持。cover はループに含め、共通テキストを出す
- コース画像ではテキスト欄の一番上にフォルダ名。Maison Neue。中央揃え
- IMAGE_ZOOM / Category modal は `content/text/TOKYO FOOD.txt`。引用符は残す。改行は `pre-line`
- CSS の title 用装飾引用符（`::before` / `::after`）は外した（ファイル側の `"TOKYO FOOD"` と二重になるため）
- `animation.json`: 4 track とも `LogoMotion_Trunk.mp4`。`durationMs` 5000 / `safetyCapMs` 7000
- LIST seed / 配置 / 壊れたファイル名は現行のまま

Gift / Flower の cover 挟みとコース本文の本接続は未実装（FB レポートへ）。

---

## 触っていないもの

CategoryDrawer 見た目、IMAGE_ZOOM カードサイズ / LOGO_TEXT / フォント、LIST FO / 速度、overlay 独立性、120秒 Non-Touch、`demo-0820` / `LIST_demo`。
