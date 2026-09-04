export const TOUCH_HIT_RING = 8;
export const TOUCH_MOVE_THROTTLE_MS = 250;

export interface LocalTouchHit {
  timestamp: number;
  monitorId: number;
  displayId: number | null;
  windowId: number | null;
  eventType: string;
  pointerId: number | null;
  pointerType: string;
  activePointerCount: number;
  nativeTouchCount: number;
  clientX: number;
  clientY: number;
  screenX: number;
  screenY: number;
}

export interface WindowMappingRow {
  monitorId: number;
  displayId: number | null;
  windowId: number | null;
  bounds: { x: number; y: number; width: number; height: number };
}

export interface WindowMappingDump {
  windows: WindowMappingRow[];
  sharedDisplayId: boolean;
  identicalBounds: boolean;
}

export interface TouchRoutingPayload {
  lastHit: LocalTouchHit | null;
  lastTouchWindowId: number | null;
  lastTouchMonitorId: number | null;
  lastTouchDisplayId: number | null;
  mapping: WindowMappingDump;
}

export interface TouchHitInput {
  eventType: string;
  pointerId: number | null;
  pointerType: string;
  activePointerCount: number;
  nativeTouchCount: number;
  clientX: number;
  clientY: number;
  screenX: number;
  screenY: number;
}

export function pushTouchHit(ring: LocalTouchHit[], hit: LocalTouchHit, max = TOUCH_HIT_RING): LocalTouchHit[] {
  const next = ring.length >= max ? ring.slice(ring.length - max + 1) : ring.slice();
  next.push(hit);
  return next;
}

export function formatTouchHit(hit: LocalTouchHit): string {
  const clock = new Date(hit.timestamp).toISOString().slice(11, 23);
  return `${clock} ${hit.eventType} ptr=${hit.pointerId ?? '—'} type=${hit.pointerType} M${hit.monitorId} display=${hit.displayId ?? '—'} win=${hit.windowId ?? '—'} pointers=${hit.activePointerCount} touches=${hit.nativeTouchCount} client=${Math.round(hit.clientX)},${Math.round(hit.clientY)} screen=${Math.round(hit.screenX)},${Math.round(hit.screenY)}`;
}

export function formatWindowMappingLines(
  mapping: WindowMappingDump | null,
  thisWindowId: number | null,
  thisMonitorId: number,
): string[] {
  if (!mapping) return ['window mapping: loading…'];
  const rows = mapping.windows.map((row) => {
    const self = row.monitorId === thisMonitorId ? ' (this)' : '';
    return `M${row.monitorId}${self} displayId=${row.displayId ?? '—'} windowId=${row.windowId ?? '—'} bounds=${row.bounds.width}x${row.bounds.height} @${row.bounds.x},${row.bounds.y}`;
  });
  return [
    `thisWindowId: ${thisWindowId ?? '—'}  thisMonitorId: ${thisMonitorId}`,
    ...rows,
    `FLAG sharedDisplayId=${mapping.sharedDisplayId}  identicalBounds=${mapping.identicalBounds}`,
  ];
}
