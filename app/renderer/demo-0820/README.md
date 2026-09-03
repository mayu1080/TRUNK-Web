# 8/20 demo renderer（Phase 1 土台）

`TRUNK_DEMO=0820` 時だけ Electron が読み込む Renderer。既存 `state-dev.html` は変更しない。

## 起動（app/ から）

```powershell
cd app
npm install
cd renderer/demo-0820
npm install
cd ../..
npm run start:0820
```

通常起動（4 window / state-dev）は従来どおり `npm start`。
