import { MOTION_CONFIG } from '../motionConfig';
import { getLastWheelDeltaDebug, resolveWheelDepthFlowDirection } from './depthFlowSpeed';

/** 空間上のカメラ Z — 固定（pan/zoom は別） */
let cameraZ = 1200;

/** 基準時間倍率（常に initial） */
let sceneTimeScale = 1;
let targetSceneTimeScale = 1;

/** +1=奥→手前 / -1=手前→奥（巻き戻し） */
let sceneTimeDriftDirection: 1 | -1 = 1;

/** Shift+ホイール中のみ — 離すと 1.0・正向きに戻る */
let timeWheelBoostActive = false;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** deltaMode をピクセル相当に正規化 */
export function normalizeWheelDelta(e: WheelEvent): { x: number; y: number } {
  let { deltaX, deltaY, deltaMode } = e;
  if (deltaMode === WheelEvent.DOM_DELTA_LINE) {
    deltaX *= 16;
    deltaY *= 16;
  } else if (deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    deltaX *= 800;
    deltaY *= 800;
  }
  return { x: deltaX, y: deltaY };
}

/**
 * Shift+ホイールの時間軸方向
 * +1 = 上スクロール（delta 負）→ 時間加速（奥→手前）
 * -1 = 下スクロール（delta 正）→ 時間巻き戻し（手前→奥）
 */
export function resolveSceneTimeWheelDirection(e: WheelEvent): 1 | -1 | null {
  resolveWheelDepthFlowDirection(e);
  const { x, y } = normalizeWheelDelta(e);
  const useHorizontal = Math.abs(x) > Math.abs(y);
  const delta = useHorizontal ? x : y;
  if (delta === 0) return null;
  return delta < 0 ? 1 : -1;
}

export function isCameraNavigationMode(): boolean {
  const { depthFlow, cameraDepth } = MOTION_CONFIG;
  return depthFlow.enabled && depthFlow.depthMode === 'camera-navigation' && cameraDepth.enabled;
}

export function isObjectFlowMode(): boolean {
  const { depthFlow } = MOTION_CONFIG;
  return depthFlow.enabled && depthFlow.depthMode === 'object-flow';
}

export function resetCameraZ(): void {
  const cfg = MOTION_CONFIG.cameraDepth;
  cameraZ = cfg.initialZ;
  sceneTimeScale = cfg.initialTimeScale;
  targetSceneTimeScale = cfg.initialTimeScale;
  sceneTimeDriftDirection = 1;
  timeWheelBoostActive = false;
}

/** @deprecated use resetCameraZ */
export const resetCameraDepth = resetCameraZ;

export function getCameraZ(): number {
  return cameraZ;
}

/** @deprecated */
export const getCameraDepth = getCameraZ;

export function getSceneTimeScale(): number {
  return sceneTimeScale;
}

export function getTargetSceneTimeScale(): number {
  return targetSceneTimeScale;
}

/** ドリフト方向 — 通常 +1、Shift+下で -1 */
export function getSceneTimeDriftDirection(): 1 | -1 {
  return timeWheelBoostActive ? sceneTimeDriftDirection : 1;
}

export function isSceneTimeWheelBoostActive(): boolean {
  return timeWheelBoostActive;
}

/** 実効 sceneZ ドリフト速度 [unit/s]（符号付き） */
export function getEffectiveSceneDriftSpeed(): number {
  return (
    MOTION_CONFIG.cameraDepth.sceneDriftSpeed *
    sceneTimeScale *
    getSceneTimeDriftDirection()
  );
}

/** @deprecated */
export function getTargetCameraZ(): number {
  return cameraZ;
}

export function getCameraZVelocity(): number {
  return targetSceneTimeScale - sceneTimeScale;
}

/** @deprecated */
export const getTargetCameraDepth = getTargetCameraZ;
/** @deprecated */
export const getCameraDepthVelocity = getCameraZVelocity;

export function setDepthFlowMode(mode: 'object-flow' | 'camera-navigation'): void {
  MOTION_CONFIG.depthFlow.depthMode = mode;
  if (mode === 'camera-navigation') {
    resetCameraZ();
  }
}

/** 毎フレーム — targetSceneTimeScale へ滑らかに追従 */
export function updateSceneTimeScale(_deltaTime: number): void {
  if (!isCameraNavigationMode()) return;

  const { smoothing, minTimeScale, maxTimeScale } = MOTION_CONFIG.cameraDepth;
  const diff = targetSceneTimeScale - sceneTimeScale;
  sceneTimeScale += diff * smoothing;
  sceneTimeScale = clamp(sceneTimeScale, minTimeScale, maxTimeScale);

  if (Math.abs(diff) < 0.001) {
    sceneTimeScale = targetSceneTimeScale;
  }
}

/** @deprecated */
export const updateCameraZ = updateSceneTimeScale;
/** @deprecated */
export const updateCameraDepth = updateSceneTimeScale;

/**
 * Shift+ホイール — 一時ブースト（Shift 離すと ×1・正向きへ復帰）
 * 上: 加速（奥→手前） / 下: 巻き戻し（手前→奥）
 */
export function applySceneTimeWheel(e: WheelEvent): void {
  const direction = resolveSceneTimeWheelDirection(e);
  if (direction === null) return;

  const { timeWheelFastScale, timeWheelRewindScale, minTimeScale, maxTimeScale } =
    MOTION_CONFIG.cameraDepth;
  timeWheelBoostActive = true;
  sceneTimeDriftDirection = direction;
  const boostScale = direction > 0 ? timeWheelFastScale : timeWheelRewindScale;
  targetSceneTimeScale = clamp(boostScale, minTimeScale, maxTimeScale);
}

/** Shift 解除 / 通常ホイール時 — 基準速度・正向きへ戻す */
export function clearSceneTimeWheelBoost(): void {
  if (!timeWheelBoostActive) return;
  timeWheelBoostActive = false;
  sceneTimeDriftDirection = 1;
  targetSceneTimeScale = MOTION_CONFIG.cameraDepth.initialTimeScale;
}

export function getSceneTimeWheelDebug(): {
  boostActive: boolean;
  direction: 'fast' | 'rewind' | 'none';
  deltaX: number;
  deltaY: number;
  axis: string;
} {
  const wheel = getLastWheelDeltaDebug();
  let direction: 'fast' | 'rewind' | 'none' = 'none';
  if (timeWheelBoostActive) {
    direction = sceneTimeDriftDirection > 0 ? 'fast' : 'rewind';
  }
  return {
    boostActive: timeWheelBoostActive,
    direction,
    deltaX: wheel.deltaX,
    deltaY: wheel.deltaY,
    axis: wheel.axis,
  };
}

/** @deprecated */
export const applyCameraZWheel = applySceneTimeWheel;
/** @deprecated */
export const applyCameraDepthWheel = applySceneTimeWheel;
