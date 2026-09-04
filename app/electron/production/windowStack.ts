import type { BrowserWindow } from 'electron';

/** Right-most production monitor stays visually on top (covers seam overlap). Visual order: 1 < 2 < 3 < 4 */
export const FIXED_MONITOR_STACK_ORDER = [1, 2, 3, 4] as const;

export function formatMonitorWindowStack(ids: readonly number[]): string {
  return ids.join(' < ');
}

export interface ApplyMonitorWindowStackOptions {
  reason: string;
  monitorId?: number;
  /** Unpackaged / site debug. Packaged production should pass false except startup. */
  verbose: boolean;
}

/**
 * Raise production windows in monitorId order so 1 < 2 < 3 < 4.
 * Does not call focus() — input target and z-order stay separate.
 */
export function applyFixedMonitorWindowStack(
  windows: Map<number, BrowserWindow>,
  options: ApplyMonitorWindowStackOptions,
): number[] {
  const stacked: number[] = [];
  for (const id of FIXED_MONITOR_STACK_ORDER) {
    const win = windows.get(id);
    if (!win || win.isDestroyed()) continue;
    win.moveTop();
    stacked.push(id);
  }
  if (options.verbose && stacked.length > 0) {
    const pointer =
      options.monitorId != null ? ` monitor=${options.monitorId}` : '';
    console.info(`[WINDOW_STACK] reason=${options.reason}${pointer}`);
    console.info(`[WINDOW_STACK] ${formatMonitorWindowStack(stacked)}`);
  }
  return stacked;
}
