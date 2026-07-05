import { MOTION_CONFIG } from '../motionConfig';

/** 通常時の倍率（初期値 = config.speedMultiplier） */
let speedMultiplier = 1;
/** 通常時の方向 +1=奥→手前 / -1=手前→奥 */
let speedDirection: 1 | -1 = 1;

/** Shift+ホイール中のみ有効な一時ブースト */
let wheelBoostActive = false;
let wheelBoostMultiplier = 1;
let wheelBoostDirection: 1 | -1 = 1;

/** 診断用 — 直近ホイール入力 */
let lastWheelDeltaX = 0;
let lastWheelDeltaY = 0;
let lastWheelAxis: 'x' | 'y' = 'y';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** deltaMode をピクセル相当に正規化（符号は維持） */
function normalizeWheelDelta(e: WheelEvent): { x: number; y: number } {
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
 * Shift+ホイールのスクロール方向 → depth flow 方向
 *
 * 多くのブラウザで Shift+縦ホイールは横スクロール（deltaX）に化けるため、
 * 優勢軸の符号で判定する。
 * 負 = 上 / 左 → 奥→手前（+1）
 * 正 = 下 / 右 → 手前→奥（-1）
 */
export function resolveWheelDepthFlowDirection(e: WheelEvent): 1 | -1 | null {
  const { x, y } = normalizeWheelDelta(e);
  lastWheelDeltaX = x;
  lastWheelDeltaY = y;

  const useHorizontal = Math.abs(x) > Math.abs(y);
  lastWheelAxis = useHorizontal ? 'x' : 'y';
  const delta = useHorizontal ? x : y;

  if (delta === 0) return null;
  return delta < 0 ? 1 : -1;
}

export function getLastWheelDeltaDebug(): {
  deltaX: number;
  deltaY: number;
  axis: 'x' | 'y';
} {
  return { deltaX: lastWheelDeltaX, deltaY: lastWheelDeltaY, axis: lastWheelAxis };
}

export function isDepthFlowWheelBoostActive(): boolean {
  return wheelBoostActive;
}

export function getDepthFlowSpeedMultiplier(): number {
  return wheelBoostActive ? wheelBoostMultiplier : speedMultiplier;
}

export function getDepthFlowSpeedDirection(): 1 | -1 {
  return wheelBoostActive ? wheelBoostDirection : speedDirection;
}

export function setDepthFlowSpeedMultiplier(value: number): void {
  const { minSpeedMultiplier, maxSpeedMultiplier } = MOTION_CONFIG.depthFlow;
  speedMultiplier = clamp(value, minSpeedMultiplier, maxSpeedMultiplier);
}

export function setDepthFlowSpeedDirection(direction: 1 | -1): void {
  speedDirection = direction;
}

/** 加算調整（将来ピンチ等向け） */
export function increaseDepthFlowSpeed(delta: number): void {
  setDepthFlowSpeedMultiplier(speedMultiplier + delta);
}

/** Shift+ホイール — 一時ブースト（×wheelStepFactor、累積しない） */
export function applyDepthFlowWheelStep(direction: 1 | -1): void {
  const { wheelStepFactor } = MOTION_CONFIG.depthFlow;
  wheelBoostActive = true;
  wheelBoostDirection = direction;
  wheelBoostMultiplier = wheelStepFactor;
}

/** Shift+ホイールイベントから方向を解決してブースト */
export function applyDepthFlowWheelFromEvent(e: WheelEvent): boolean {
  const direction = resolveWheelDepthFlowDirection(e);
  if (direction === null) return false;
  applyDepthFlowWheelStep(direction);
  return true;
}

/** Shift+ホイール解除 — 初期速度へ戻す */
export function clearDepthFlowWheelBoost(): void {
  wheelBoostActive = false;
}

export function resetDepthFlowSpeed(): void {
  speedMultiplier = MOTION_CONFIG.depthFlow.speedMultiplier;
  speedDirection = 1;
  clearDepthFlowWheelBoost();
}

/** |baseSpeed × 現在有効 multiplier| */
export function getEffectiveDepthFlowSpeed(): number {
  return MOTION_CONFIG.depthFlow.baseSpeed * getDepthFlowSpeedMultiplier();
}

/** 積分用 — 符号付き実効速度（個体差込み） */
export function computeSignedFlowSpeed(flowSpeedVariance: number): number {
  const magnitude = getEffectiveDepthFlowSpeed() + flowSpeedVariance;
  return magnitude * getDepthFlowSpeedDirection();
}
