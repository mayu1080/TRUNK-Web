/** Diagnostic only. Does not accept/drop events. Ring is per renderer (per BrowserWindow). */

export type InputTraceDecision =
  | 'ACCEPT'
  | 'DROP_DUPLICATE_POINTERDOWN'
  | 'DROP_SESSION_MISMATCH'
  | 'DROP_STALE_START'
  | 'DROP_NOT_BELONG_TO_WINDOW'
  | 'DROP_INTERACTION_LOCK'
  | 'DROP_NATIVE_TOUCH_COUNT'
  | 'DROP_MULTI_TOUCH_BLOCKED'
  | 'DROP_TWO_FINGER_SESSION'
  | 'INFO';

export interface InputTraceRow {
  ts: number;
  monitorId: number;
  windowId: number | null;
  eventType: string;
  decision: InputTraceDecision;
  pointerId: number | string | null;
  pointerType: string;
  isPrimary: boolean | null;
  clientX: number | null;
  clientY: number | null;
  screenX: number | null;
  screenY: number | null;
  buttons: number | null;
  button?: number | null;
  target: string;
  currentTarget?: string;
  cancelable: boolean | null;
  defaultPrevented: boolean | null;
  capture: boolean | null;
  nativeTouchCount: number | null;
  pointerCount: number | null;
  touchIdentifier?: number | string | null;
  touchesLength?: number | null;
  changedTouchesLength?: number | null;
  activePointerCount?: number | null;
  activeTouchPointerCount?: number | null;
  gestureMode?: string | null;
  interactionSessionId?: number | null;
  pointerSessionId?: number | null;
  interactionLocked?: boolean | null;
  extra?: string;
}

const RING = 32;
const rows: InputTraceRow[] = [];

function targetName(target: EventTarget | null): string {
  if (!(target instanceof Element)) return String(target ?? '—');
  const id = target.id ? `#${target.id}` : '';
  const cls = typeof target.className === 'string' && target.className.trim()
    ? `.${target.className.trim().split(/\s+/).slice(0, 3).join('.')}`
    : '';
  return `${target.tagName.toLowerCase()}${id}${cls}`.slice(0, 80);
}

export function describeEventTarget(target: EventTarget | null): string {
  return targetName(target);
}

export function observeAllMoves(): boolean {
  try {
    if (typeof window !== 'undefined' && Boolean((window as Window & { __observeAllMoves?: boolean }).__observeAllMoves)) {
      return true;
    }
    return typeof localStorage !== 'undefined' && localStorage.getItem('TRUNK_OBSERVE_ALL_MOVES') === '1';
  } catch {
    return false;
  }
}

export function formatInputTraceRow(row: InputTraceRow): string {
  const t = new Date(row.ts).toISOString().slice(11, 23);
  const xy =
    row.clientX != null && row.clientY != null ? ` client=${Math.round(row.clientX)},${Math.round(row.clientY)}` : '';
  return `${t} M${row.monitorId} win=${row.windowId ?? '—'} ${row.decision} ${row.eventType} ptr=${row.pointerId ?? '—'} type=${row.pointerType}${xy} nTouch=${row.nativeTouchCount ?? '—'} nPtr=${row.pointerCount ?? '—'} tgt=${row.target}${row.extra ? ` ${row.extra}` : ''}`;
}

export function getInputTraceRows(): string[] {
  return rows.map(formatInputTraceRow);
}

function persistObservation(row: InputTraceRow): void {
  const isMove = row.eventType === 'pointermove' || row.eventType === 'touchmove' || row.eventType === 'mousemove';
  if (isMove && row.decision === 'ACCEPT' && !observeAllMoves()) return;
  window.trunkApi?.appendObservation?.({
    source: 'renderer',
    monitorId: row.monitorId,
    windowId: row.windowId,
    event: row.eventType,
    decision: row.decision,
    reason: row.extra ?? null,
    pointerId: row.pointerId,
    pointerType: row.pointerType,
    isPrimary: row.isPrimary,
    buttons: row.buttons,
    button: row.button ?? null,
    clientX: row.clientX,
    clientY: row.clientY,
    screenX: row.screenX,
    screenY: row.screenY,
    target: row.target,
    currentTarget: row.currentTarget ?? null,
    defaultPrevented: row.defaultPrevented,
    nativeTouchCount: row.nativeTouchCount,
    activePointerCount: row.activePointerCount ?? row.pointerCount,
    activeTouchPointerCount: row.activeTouchPointerCount ?? null,
    touchIdentifier: row.touchIdentifier ?? null,
    touchesLength: row.touchesLength ?? null,
    changedTouchesLength: row.changedTouchesLength ?? null,
    gestureMode: row.gestureMode ?? null,
    interactionSessionId: row.interactionSessionId ?? null,
    pointerSessionId: row.pointerSessionId ?? null,
    interactionLocked: row.interactionLocked ?? null,
  });
}

export function pushInputTrace(row: Omit<InputTraceRow, 'ts'> & { ts?: number }): InputTraceRow {
  const full: InputTraceRow = { ...row, ts: row.ts ?? Date.now() };
  rows.push(full);
  if (rows.length > RING) rows.splice(0, rows.length - RING);
  const line = `[INPUT_TRACE] ${formatInputTraceRow(full)}`;
  const isMove = full.eventType === 'pointermove' || full.eventType === 'touchmove' || full.eventType === 'mousemove';
  if (!isMove || full.decision.startsWith('DROP_') || observeAllMoves()) {
    console.info(line);
  }
  persistObservation(full);
  return full;
}

export function rowFromPointer(
  event: PointerEvent,
  fields: {
    monitorId: number;
    windowId: number | null;
    decision: InputTraceDecision;
    nativeTouchCount?: number;
    pointerCount?: number;
    extra?: string;
    capture?: boolean;
    activeTouchPointerCount?: number;
    gestureMode?: string | null;
    interactionSessionId?: number | null;
    pointerSessionId?: number | null;
    interactionLocked?: boolean | null;
  },
): Omit<InputTraceRow, 'ts'> {
  return {
    monitorId: fields.monitorId,
    windowId: fields.windowId,
    eventType: event.type,
    decision: fields.decision,
    pointerId: event.pointerId,
    pointerType: event.pointerType || 'unknown',
    isPrimary: event.isPrimary,
    clientX: event.clientX,
    clientY: event.clientY,
    screenX: event.screenX,
    screenY: event.screenY,
    buttons: event.buttons,
    button: event.button,
    target: targetName(event.target),
    currentTarget: targetName(event.currentTarget),
    cancelable: event.cancelable,
    defaultPrevented: event.defaultPrevented,
    capture: fields.capture ?? null,
    nativeTouchCount: fields.nativeTouchCount ?? null,
    pointerCount: fields.pointerCount ?? null,
    activePointerCount: fields.pointerCount ?? null,
    activeTouchPointerCount: fields.activeTouchPointerCount ?? null,
    gestureMode: fields.gestureMode ?? null,
    interactionSessionId: fields.interactionSessionId ?? null,
    pointerSessionId: fields.pointerSessionId ?? null,
    interactionLocked: fields.interactionLocked ?? null,
    extra: fields.extra,
  };
}
