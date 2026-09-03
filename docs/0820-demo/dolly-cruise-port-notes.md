# Dolly Cruise 移植メモ（Phase 6.5）

| 項目 | 内容 |
|------|------|
| 作成日 | 2026-08-19 |
| 参照 | DI `LIST_demo/demos/DI-three-bubble-reveal`（実体は DF と同系） |
| 対象 | `app/renderer/demo-0820` |
| 本番反映 | Shift+scroll / pinch の dolly cruise は 8/20 および本番でも同じ質感を使う |

LIST_demo 本体は変更しない。

---

## DI での Shift+scroll 挙動

通常 wheel と Shift+wheel は **別系統**。

### 通常 wheel（scrub）

- `targetCameraZ -= deltaY * 0.55 * wheelSensitivity`
- そのフレームで目標 Z を直接動かす
- カメラ位置は毎フレーム `lerp(cameraZ, targetCameraZ, smoothing=0.12)` で追従
- 余韻は「目標への短い追従」だけ。速度バッファは無い
- Shift を離した通常 wheel はクルーズ速度を `scrubCancelBrake` で強く減衰させる

### Shift+wheel（dolly cruise）

1. `event.shiftKey` または window の Shift 押下フラグ `shiftHeld`
2. delta を px 相当に正規化（LINE/PAGE 補正、横スクロール優勢なら deltaX）
3. **impulse** を速度へ加算。`targetCameraZ` へは直接足さない
4. 毎フレーム `cruiseVelocityZ *= exp(-friction * dt)` のあと `targetCameraZ += cruiseVelocityZ * dt`
5. `wrapDepthLoop` で Z 境界は hard stop せず世界ごと wrap
6. クルーズ中は pose lerp を `0.2`、速度に応じて FOV を最大 +3.2°（breathe）

符号（DI どおり）:

- Shift で delta &lt; 0（上方向）→ `cruiseVelocityZ` が負 → Z が減る（潜る）
- 通常 wheel の `targetCameraZ -= deltaY` とは入力方向の対応が異なる。移植時も Shift 側は DI 符号を維持する

---

## DI の主要パラメータ（`DOLLY_CRUISE`）

| キー | 値 | 意味 |
|------|----|------|
| `impulsePer100px` | 520 | ホイール 100px 相当の速度インパルス [unit/s] |
| `maxSpeed` | 1600 | クルーズ速度上限 [unit/s] |
| `coastFriction` | 1.15 | Shift 保持中の惰性摩擦 |
| `releaseBrake` | 3.8 | Shift を離したあとのブレーキ（余韻は残るが長く流れすぎない） |
| `scrubCancelBrake` | 8 | 通常 wheel 時にクルーズを殺す |
| `poseSmoothingCruise` | 0.2 | クルーズ中の camera 追従 |
| `fovWidenAtFullSpeed` | 3.2 | 全速時の FOV 加算 |
| `fovSmoothing` | 0.07 | FOV 追従 |
| 速度ゼロ閾値 | 2 | これ未満で停止 |
| クルーズ判定 | `\|v\| > 8` | pose/FOV 切替 |
| impulse cap | `min(\|deltaPx\|, 160)` | 1 イベントの過大入力を抑える |

摩擦は `v *= exp(-k * dt)`。k=1.15 なら約 0.6s で半分、k=3.8 なら約 0.18s で半分。急停止には見えない。

---

## demo-0820 で抜けていた点

Phase 6 時点の `onWheel`:

- `shiftKey` を見ていない
- 通常 / Shift の分岐が無い
- `cruiseVelocityZ` が無い
- impulse / friction / coast / release brake が無い
- FOV breathe が無い
- クルーズ中の pose smoothing 切替が無い
- Shift の keydown 追跡が無い
- pinch が無い

結果: wheel は毎回 `targetCameraZ` を直接動かすだけで、DI のヌルヌル／余韻が出ない。

---

## demo-0820 への移植方針

1. DI と同じ `DOLLY_CRUISE` 定数を `sceneLayout.ts` に置く（ワールドサイズは触らない）
2. `applyDollyImpulse(deltaPx, source)` と `updateDollyMotion(dt)` を ExploreController に追加
3. Shift+wheel と 2 本指 pinch は同じ impulse → velocity → wrap 経路
4. 通常 wheel は既存の直接 `targetCameraZ` 更新を残し、クルーズ速度だけ減衰させる
5. overlay / drawer / DETAIL では `interactionEnabled === false` のため入力も積分も止める（既存ゲート）

`source`: `'shift-wheel' | 'pinch' | 'wheel'`

---

## WinTouch pinch への接続

Phase 6.5 では pointer 2 本を検出する。

- 2 点間距離の増加（pinch out）→ DI の「潜る」方向（`direction = 1`）
- 距離の減少（pinch in）→ 「引く」
- 距離変化 [px] を `applyDollyImpulse` に渡す（`pinchDollyScale` で感度）
- 2 本中は pan しない、up 時 tap しない
- 指を離したあとは `releaseBrake` で余韻

実機確認は Phase 7。構造は 6.5 で入れる。

開発用: Windows タッチパッドの pinch が `ctrl+wheel` になる場合は、同じ cruise 経路へ流す（`lastDollyInput: pinch`）。

---

## 変更予定ファイル

- `docs/0820-demo/dolly-cruise-port-notes.md`（本メモ）
- `app/renderer/demo-0820/src/three/sceneLayout.ts`
- `app/renderer/demo-0820/src/three/exploreController.ts`
- `app/renderer/demo-0820/src/demoConfig.ts`
- `app/renderer/demo-0820/src/runtimeConfig.ts`
- `app/renderer/demo-0820/src/types.ts`
- `app/renderer/demo-0820/src/ui/DebugHud.tsx`
- `app/renderer/demo-0820/src/ui/DemoToggles.tsx`
- `app/renderer/demo-0820/src/App.tsx`
- `app/renderer/demo-0820/src/three/ExploreHost.tsx`
