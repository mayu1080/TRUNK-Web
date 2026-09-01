# DE — Camera Depth Navigation (E-2)

DD（E: object-flow）と**別ポート**で並行起動し、カメラ奥行きナビゲーションを比較検証するデモ。

| | **DD** | **DE** |
|---|---|---|
| URL | http://localhost:5175 | **http://localhost:5176** |
| Depth | E — object-flow（画像が奥→手前へ流れる） | E-2 — camera-navigation（視点が奥・手前に動く） |
| Shift+wheel | flow speed | cameraDepth |

ソースは `../DD-pixi-three-style/` を共有。`VITE_DEMO_ID=DE` で起動時の depth モードのみ切り替え。

## 起動

```bash
cd LIST_demo
npm run demo:de
```

または:

```bash
cd LIST_demo/demos/DE-pixi-camera-depth
npm install   # 初回のみ
npm run demo:de
```

**DD と同時比較:**

```bash
# ターミナル 1
cd LIST_demo && npm run demo:dd

# ターミナル 2
cd LIST_demo && npm run demo:de
```

- DD: http://localhost:5175
- DE: http://localhost:5176

## 操作（E-2）

- **drag**: panX / panY
- **Shift + wheel**: cameraDepth（奥へ / 手前へ）
- **wheel**: zoom
