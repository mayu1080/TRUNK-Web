/**
 * Per-window LIST gesture helpers (Phase 7.6).
 * Camera pan / bubble / pointer ownership stay local to one BrowserWindow.
 * Global idle activity must not reuse these records.
 */

export const CAMERA_PAN_DEBUG_RING = 8;
export const BUBBLE_ACTION_DEBUG_RING = 8;
export const STALE_START_REPLAY_PX = 2;
export const STALE_START_REPLAY_FROM_LAST_PX = 8;
export const VIEWPORT_EVENT_MARGIN_PX = 80;

export type CameraUpdateReason =
  | 'one-finger-pan'
  | 'stale-start-replay-ignored'
  | 'foreign-window-ignored'
  | 'session-mismatch-ignored'
  | 'duplicate-pointerdown-kept'
  | 'outside-viewport-ignored'
  | 'not-dragging'
  | 'zero-delta';

export interface LocalPointerRecord {
  id: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  sessionId: number;
  ownerMonitorId: number;
  ownerWindowId: number | null;
  ownerDisplayId: number | null;
  pointerType: string;
  dragging: boolean;
}

export interface CameraPanDecision {
  applyPan: boolean;
  updateLast: boolean;
  dx: number;
  dy: number;
  reason: CameraUpdateReason;
}

export interface CameraPanDebugSample {
  timestamp: number;
  windowId: number | null;
  monitorId: number;
  displayId: number | null;
  sourceEventType: string;
  sourcePointerId: number;
  sourcePointerType: string;
  gestureMode: string;
  activePointerCount: number;
  clientX: number;
  clientY: number;
  previousX: number;
  previousY: number;
  deltaX: number;
  deltaY: number;
  cameraBeforeX: number;
  cameraBeforeY: number;
  cameraAfterX: number;
  cameraAfterY: number;
  cameraUpdateReason: CameraUpdateReason;
  gestureSessionId: number;
}

export function eventBelongsToWindow(input: {
  viewIsThisWindow: boolean;
  clientX: number;
  clientY: number;
  viewportWidth: number;
  viewportHeight: number;
}): boolean {
  if (!input.viewIsThisWindow) return false;
  const margin = VIEWPORT_EVENT_MARGIN_PX;
  if (input.clientX < -margin || input.clientY < -margin) return false;
  if (input.clientX > input.viewportWidth + margin) return false;
  if (input.clientY > input.viewportHeight + margin) return false;
  return true;
}

export function isDuplicateLocalPointerDown(
  existing: LocalPointerRecord | undefined,
  interactionSessionId: number,
): boolean {
  return Boolean(existing && existing.sessionId === interactionSessionId);
}

export function decideOneFingerPanMove(input: {
  pointer: LocalPointerRecord;
  clientX: number;
  clientY: number;
  interactionSessionId: number;
  ownerMonitorId: number;
  ownerWindowId: number | null;
}): CameraPanDecision {
  const dx = input.clientX - input.pointer.lastX;
  const dy = input.clientY - input.pointer.lastY;
  if (input.pointer.sessionId !== input.interactionSessionId) {
    return { applyPan: false, updateLast: false, dx, dy, reason: 'session-mismatch-ignored' };
  }
  if (input.pointer.ownerMonitorId !== input.ownerMonitorId) {
    return { applyPan: false, updateLast: false, dx, dy, reason: 'foreign-window-ignored' };
  }
  if (
    input.ownerWindowId != null &&
    input.pointer.ownerWindowId != null &&
    input.pointer.ownerWindowId !== input.ownerWindowId
  ) {
    return { applyPan: false, updateLast: false, dx, dy, reason: 'foreign-window-ignored' };
  }

  const distToStart = Math.hypot(input.clientX - input.pointer.startX, input.clientY - input.pointer.startY);
  const distFromLast = Math.hypot(dx, dy);
  const lastFromStart = Math.hypot(
    input.pointer.lastX - input.pointer.startX,
    input.pointer.lastY - input.pointer.startY,
  );
  // After another monitor is focused, Windows/Chromium may replay pointermove
  // at the original down point. That would snap camera back toward startX/startY.
  if (
    input.pointer.dragging &&
    distToStart <= STALE_START_REPLAY_PX &&
    distFromLast > STALE_START_REPLAY_FROM_LAST_PX &&
    lastFromStart > STALE_START_REPLAY_FROM_LAST_PX
  ) {
    return { applyPan: false, updateLast: false, dx, dy, reason: 'stale-start-replay-ignored' };
  }

  if (!input.pointer.dragging) {
    return { applyPan: false, updateLast: true, dx, dy, reason: 'not-dragging' };
  }
  if (dx === 0 && dy === 0) {
    return { applyPan: false, updateLast: true, dx, dy, reason: 'zero-delta' };
  }
  return { applyPan: true, updateLast: true, dx, dy, reason: 'one-finger-pan' };
}

/** Bubble follows local 1-finger only. 0 = hide delay, 2+ = hide now. */
export function localBubbleFingerGate(effectiveFingerCount: number): 'show' | 'hide-multi' | 'release' {
  if (effectiveFingerCount >= 2) return 'hide-multi';
  if (effectiveFingerCount === 1) return 'show';
  return 'release';
}

export type BubbleActionReason = 'show-one-finger' | 'hide-multi' | 'hide-timer' | 'hide-disallowed';

export interface BubbleActionDebugSample {
  timestamp: number;
  monitorId: number;
  action: BubbleActionReason;
  localFingerCount: number;
  clientX: number;
  clientY: number;
}

export function formatBubbleActionDebugSample(sample: BubbleActionDebugSample): string {
  const t = new Date(sample.timestamp).toISOString().slice(11, 23);
  return [
    `${t} M${sample.monitorId} ${sample.action}`,
    `fingers=${sample.localFingerCount}`,
    `client=${Math.round(sample.clientX)},${Math.round(sample.clientY)}`,
  ].join(' ');
}

/**
 * Cheap four-window simulation: each monitor gates Bubble on its own finger count.
 * M1+M3 one-finger → two visible (not a global 2-finger hide).
 * M1–M4 one-finger → count 4. M3 two-finger hides only M3; M1 hide timer stays armed.
 */
export function simulateFourMonitorBubbleIndependence(): {
  m1AndM3BothVisible: boolean;
  allFourVisibleCount: number;
  m3TwoFingerHidesOnlyM3: boolean;
} {
  type Win = { monitorId: number; localFingerCount: number; hideTimerArmed: boolean };
  const windows: Win[] = [
    { monitorId: 1, localFingerCount: 1, hideTimerArmed: true },
    { monitorId: 2, localFingerCount: 1, hideTimerArmed: true },
    { monitorId: 3, localFingerCount: 1, hideTimerArmed: true },
    { monitorId: 4, localFingerCount: 1, hideTimerArmed: true },
  ];
  const visible = (w: Win) => localBubbleFingerGate(w.localFingerCount) === 'show';
  const m1AndM3BothVisible = visible(windows[0]!) && visible(windows[2]!);
  const allFourVisibleCount = windows.filter(visible).length;

  windows[2]!.localFingerCount = 2;
  windows[2]!.hideTimerArmed = false;
  const m3TwoFingerHidesOnlyM3 =
    visible(windows[0]!) &&
    windows[0]!.hideTimerArmed &&
    localBubbleFingerGate(windows[2]!.localFingerCount) === 'hide-multi' &&
    visible(windows[1]!) &&
    visible(windows[3]!);

  return { m1AndM3BothVisible, allFourVisibleCount, m3TwoFingerHidesOnlyM3 };
}

export function formatCameraPanDebugSample(sample: CameraPanDebugSample): string {
  const t = new Date(sample.timestamp).toISOString().slice(11, 23);
  return [
    `${t} M${sample.monitorId} win=${sample.windowId ?? '—'} display=${sample.displayId ?? '—'}`,
    `${sample.sourceEventType} ptr=${sample.sourcePointerId} ${sample.sourcePointerType}`,
    `session=${sample.gestureSessionId} pointers=${sample.activePointerCount} mode=${sample.gestureMode}`,
    `client=${Math.round(sample.clientX)},${Math.round(sample.clientY)} prev=${Math.round(sample.previousX)},${Math.round(sample.previousY)} d=${sample.deltaX.toFixed(1)},${sample.deltaY.toFixed(1)}`,
    `cam ${sample.cameraBeforeX.toFixed(1)},${sample.cameraBeforeY.toFixed(1)} → ${sample.cameraAfterX.toFixed(1)},${sample.cameraAfterY.toFixed(1)}`,
    sample.cameraUpdateReason,
  ].join(' ');
}

/**
 * Cheap two-window simulation: M3 pointerdown must not pan M1 when M1 finger is held still.
 */
export function simulateTwoMonitorPanIsolation(): { m1Moved: boolean; m3Moved: boolean } {
  const m1: LocalPointerRecord = {
    id: 11,
    startX: 100,
    startY: 200,
    lastX: 420,
    lastY: 210,
    sessionId: 1,
    ownerMonitorId: 1,
    ownerWindowId: 101,
    ownerDisplayId: 1,
    pointerType: 'touch',
    dragging: true,
  };
  const held = decideOneFingerPanMove({
    pointer: m1,
    clientX: 420,
    clientY: 210,
    interactionSessionId: 1,
    ownerMonitorId: 1,
    ownerWindowId: 101,
  });
  const replay = decideOneFingerPanMove({
    pointer: m1,
    clientX: 100,
    clientY: 200,
    interactionSessionId: 1,
    ownerMonitorId: 1,
    ownerWindowId: 101,
  });
  const foreign = decideOneFingerPanMove({
    pointer: { ...m1, ownerMonitorId: 3, ownerWindowId: 103, sessionId: 99 },
    clientX: 500,
    clientY: 500,
    interactionSessionId: 1,
    ownerMonitorId: 1,
    ownerWindowId: 101,
  });
  const m3: LocalPointerRecord = {
    id: 21,
    startX: 80,
    startY: 90,
    lastX: 80,
    lastY: 90,
    sessionId: 7,
    ownerMonitorId: 3,
    ownerWindowId: 103,
    ownerDisplayId: 3,
    pointerType: 'touch',
    dragging: true,
  };
  const m3Pan = decideOneFingerPanMove({
    pointer: m3,
    clientX: 96,
    clientY: 90,
    interactionSessionId: 7,
    ownerMonitorId: 3,
    ownerWindowId: 103,
  });
  return {
    m1Moved: held.applyPan || replay.applyPan || foreign.applyPan,
    m3Moved: m3Pan.applyPan,
  };
}
