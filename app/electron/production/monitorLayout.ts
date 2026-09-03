import fs from 'node:fs';
import path from 'node:path';
import { resolveContentPath } from '../content/contentRoot';
import type { MonitorLayoutEntry, MonitorLayoutFile } from '../../shared/productionState';

export const MONITOR_LAYOUT_RELATIVE = 'monitor-layout.json';
export const REQUIRED_MONITOR_IDS = [1, 2, 3, 4] as const;

export class MonitorLayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MonitorLayoutError';
  }
}

export function resolveMonitorLayoutPath(contentRoot: string): string {
  return resolveContentPath(contentRoot, MONITOR_LAYOUT_RELATIVE);
}

function asFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new MonitorLayoutError(`monitor-layout.json: ${field} must be a finite number`);
  }
  return value;
}

function parseMonitor(raw: unknown, index: number): MonitorLayoutEntry {
  if (!raw || typeof raw !== 'object') {
    throw new MonitorLayoutError(`monitor-layout.json: monitors[${index}] must be an object`);
  }
  const row = raw as Record<string, unknown>;
  const orientation = row.orientation;
  if (orientation !== 'portrait' && orientation !== 'landscape') {
    throw new MonitorLayoutError(
      `monitor-layout.json: monitors[${index}].orientation must be portrait or landscape`,
    );
  }
  const monitorId = asFiniteNumber(row.monitorId, `monitors[${index}].monitorId`);
  if (!Number.isInteger(monitorId) || monitorId < 1 || monitorId > 4) {
    throw new MonitorLayoutError(`monitor-layout.json: monitors[${index}].monitorId must be 1..4`);
  }
  return {
    monitorId,
    x: asFiniteNumber(row.x, `monitors[${index}].x`),
    y: asFiniteNumber(row.y, `monitors[${index}].y`),
    width: asFiniteNumber(row.width, `monitors[${index}].width`),
    height: asFiniteNumber(row.height, `monitors[${index}].height`),
    orientation,
    viewportOffsetX: asFiniteNumber(row.viewportOffsetX, `monitors[${index}].viewportOffsetX`),
    viewportOffsetY: asFiniteNumber(row.viewportOffsetY, `monitors[${index}].viewportOffsetY`),
    scale: asFiniteNumber(row.scale, `monitors[${index}].scale`),
  };
}

export function parseMonitorLayoutFile(raw: unknown): MonitorLayoutFile {
  if (!raw || typeof raw !== 'object') {
    throw new MonitorLayoutError('monitor-layout.json must be an object');
  }
  const doc = raw as Record<string, unknown>;
  const boundsTolerancePx = asFiniteNumber(doc.boundsTolerancePx, 'boundsTolerancePx');
  if (typeof doc.fatalOnBoundsMismatch !== 'boolean') {
    throw new MonitorLayoutError('monitor-layout.json: fatalOnBoundsMismatch must be a boolean');
  }
  if (!Array.isArray(doc.monitors)) {
    throw new MonitorLayoutError('monitor-layout.json: monitors must be an array');
  }
  const monitors = doc.monitors.map((item, i) => parseMonitor(item, i));
  const ids = monitors.map((m) => m.monitorId).sort((a, b) => a - b);
  const expected = [...REQUIRED_MONITOR_IDS];
  if (ids.length !== 4 || ids.some((id, i) => id !== expected[i])) {
    throw new MonitorLayoutError(
      `monitor-layout.json: monitors must define monitorId 1..4 exactly once (got ${ids.join(',')})`,
    );
  }
  return {
    boundsTolerancePx: Math.max(0, boundsTolerancePx),
    fatalOnBoundsMismatch: doc.fatalOnBoundsMismatch,
    monitors: monitors.sort((a, b) => a.monitorId - b.monitorId),
  };
}

export function loadMonitorLayout(contentRoot: string): {
  layout: MonitorLayoutFile;
  layoutPath: string;
} {
  const layoutPath = path.normalize(resolveMonitorLayoutPath(contentRoot));
  if (!fs.existsSync(layoutPath)) {
    throw new MonitorLayoutError(
      `monitor-layout.json is required for the production shell: ${layoutPath}`,
    );
  }
  let text: string;
  try {
    text = fs.readFileSync(layoutPath, 'utf8');
  } catch (err) {
    throw new MonitorLayoutError(
      `failed to read monitor-layout.json: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new MonitorLayoutError(
      `monitor-layout.json is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return { layout: parseMonitorLayoutFile(json), layoutPath };
}
