# 現場オペレーター引継ぎ（ここだけ読めば起動できる）

会場で Git クローンして production を動かす人向け。`docs/production/` の設計メモや Phase 報告は、当日は開かなくてよい。

| 先に読む | 内容 |
|----------|------|
| [インストール.md](./インストール.md) | 入れるモジュールと手順 |
| [起動コマンド.md](./起動コマンド.md) | preview / production の起動 |
| [よくあるエラー.md](./よくあるエラー.md) | TS7026・Three 不足・`npm run dev` を繰り返さない |

---

## 当日の最短ルート

1. Node.js **22.12 以上**が入っていることを確認する
2. GitHub から `feature/production-phase7` を浅くクローンする
3. USB の `content/` をリポジトリ直下に載せる（画像・動画・フォント・Logo・text）
4. **`app` と `app/renderer/production` の 2 か所**でモジュールを入れる
5. `app` で `npm run start:production:preview`（1 画面確認）
6. 4 面本番は `npm run start:production:site`（または `launch-production-site.bat`）

**使わない:** `npm run dev`。Vite だけ、または本番 4 画面ではない Electron が立ち上がる。型エラーはこれでは直らない。

---

## クローン（軽い取り方）

```powershell
git clone --single-branch --depth 1 -b feature/production-phase7 https://github.com/mayu1080/TRUNK-Web.git
```

`LIST_demo` は入らない。普通の `git clone` だと他ブランチまで降りて重くなる。

---

## 設計・QA 資料（必要なときだけ）

| 資料 | いつ開く |
|------|----------|
| [docs/production/phase7-site-preflight.md](../docs/production/phase7-site-preflight.md) | 4 画面配置・Windows 設定・content 確認 |
| [docs/production/phase7-site-qa-checklist.md](../docs/production/phase7-site-qa-checklist.md) | 起動後の操作確認 |
| [docs/production/production-runtime-spec.md](../docs/production/production-runtime-spec.md) | 4 面同期・overlay・120 秒 idle |
| `docs/handover.md` | **使わない**（古い納品引継ぎ。当日手順ではない） |
