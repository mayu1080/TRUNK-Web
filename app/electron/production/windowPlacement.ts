import type { Display } from 'electron';
import type { MonitorLayoutEntry, MonitorLayoutFile } from '../../shared/productionState';
import {
  choosePreviewGrid,
  parseProductionPreviewConfig,
  previewLogicalSize,
  type ProductionPreviewConfig,
  type ProductionPreviewMode,
  type ProductionPreviewWindows,
} from './previewConfig';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MonitorPlacement {
  monitorId: number;
  bounds: Rect;
  config: MonitorLayoutEntry;
  matchedDisplayId: number | null;
  boundsMismatch: boolean;
}

export interface WindowPlacementResult {
  isDevFallback: boolean;
  isPreviewMode: boolean;
  previewMode: ProductionPreviewMode;
  previewWindows: 'off' | ProductionPreviewWindows;
  previewFrame: boolean;
  previewScale: number | null;
  previewLogicalWidth: number | null;
  previewLogicalHeight: number | null;
  boundsMismatch: boolean;
  fatalOnBoundsMismatch: boolean;
  shouldQuit: boolean;
  quitReason: string | null;
  managementDisplayIds: number[];
  windows: MonitorPlacement[];
  warnings: string[];
}

const PREVIEW_GAP = 12;

function emptyPreview() {
  return {
    isPreviewMode: false,
    previewMode: 'off' as const,
    previewWindows: 'off' as const,
    previewFrame: false,
    previewScale: null,
    previewLogicalWidth: null,
    previewLogicalHeight: null,
  };
}

export function tilePreviewBounds(
  area: Rect,
  monitorId: number,
  windowWidth: number,
  windowHeight: number,
  cols = 2,
  gap = PREVIEW_GAP,
): Rect {
  const col = (monitorId - 1) % cols;
  const row = Math.floor((monitorId - 1) / cols);
  return {
    x: area.x + gap + col * (windowWidth + gap),
    y: area.y + gap + row * (windowHeight + gap),
    width: windowWidth,
    height: windowHeight,
  };
}

function rectsWithinTolerance(a: Rect, b: Rect, tolerance: number): boolean {
  return (
    Math.abs(a.x - b.x) <= tolerance &&
    Math.abs(a.y - b.y) <= tolerance &&
    Math.abs(a.width - b.width) <= tolerance &&
    Math.abs(a.height - b.height) <= tolerance
  );
}

function displayRect(display: Display): Rect {
  return {
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
  };
}

function tileDevFallback(area: Rect, monitorId: number): Rect {
  const gap = 10;
  const cols = 2;
  const rows = 2;
  const col = (monitorId - 1) % cols;
  const row = Math.floor((monitorId - 1) / cols);
  const width = Math.max(280, Math.floor((area.width - gap * (cols + 1)) / cols));
  const height = Math.max(420, Math.floor((area.height - gap * (rows + 1)) / rows));
  return {
    x: area.x + gap + col * (width + gap),
    y: area.y + gap + row * (height + gap),
    width,
    height,
  };
}

function sortDisplays(displays: Display[]): Display[] {
  return [...displays].sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y || a.id - b.id);
}

function workAreaRect(display: Display): Rect {
  return {
    x: display.workArea.x,
    y: display.workArea.y,
    width: display.workArea.width,
    height: display.workArea.height,
  };
}

function buildPreviewPlacement(
  layout: MonitorLayoutFile,
  preview: ProductionPreviewConfig,
  primary: Display,
  sorted: Display[],
  fatal: boolean,
  warnings: string[],
): WindowPlacementResult {
  const area = workAreaRect(primary);
  const first = layout.monitors[0]!;
  const logical = previewLogicalSize(preview.mode === 'off' ? 'portrait' : preview.mode, first.width, first.height);
  const grid = choosePreviewGrid(
    area,
    logical.width,
    logical.height,
    preview.requestedScale,
    PREVIEW_GAP,
    preview.windows,
  );
  const scale = grid.scale;
  const windowWidth = Math.max(160, Math.round(logical.width * scale));
  const windowHeight = Math.max(240, Math.round(logical.height * scale));
  warnings.push(
    `production preview mode=${preview.mode} windows=${preview.windows} frame=${preview.frame ? 'on' : 'off'} scale=${scale.toFixed(3)} grid=${grid.cols}x${grid.rows} logical=${logical.width}x${logical.height} window=${windowWidth}x${windowHeight} on display id=${primary.id}`,
  );
  const monitors =
    preview.windows === 'single'
      ? [layout.monitors.find((row) => row.monitorId === 1) ?? layout.monitors[0]!]
      : layout.monitors;
  const windows = monitors.map((monitor) => {
    const bounds =
      preview.windows === 'single'
        ? {
            x: area.x + Math.round((area.width - windowWidth) / 2),
            y: area.y + Math.round((area.height - windowHeight) / 2),
            width: windowWidth,
            height: windowHeight,
          }
        : tilePreviewBounds(area, monitor.monitorId, windowWidth, windowHeight, grid.cols);
    return {
      monitorId: monitor.monitorId,
      bounds,
      config: monitor,
      matchedDisplayId: primary.id,
      boundsMismatch: true,
    };
  });
  return {
    isDevFallback: false,
    isPreviewMode: true,
    previewMode: preview.mode,
    previewWindows: preview.windows,
    previewFrame: preview.frame === true,
    previewScale: scale,
    previewLogicalWidth: logical.width,
    previewLogicalHeight: logical.height,
    boundsMismatch: true,
    fatalOnBoundsMismatch: fatal,
    shouldQuit: false,
    quitReason: null,
    managementDisplayIds: sorted.filter((d) => d.id !== primary.id).map((d) => d.id),
    windows,
    warnings,
  };
}

/**
 * Match layout monitors to OS displays.
 * Management displays (not among the 4 experience windows) are left unused.
 */
export function resolveWindowPlacement(
  layout: MonitorLayoutFile,
  displays: Display[],
  options: { isPackaged: boolean; preview?: ProductionPreviewConfig },
): WindowPlacementResult {
  const warnings: string[] = [];
  const tolerance = layout.boundsTolerancePx;
  const fatal = layout.fatalOnBoundsMismatch;
  const preview = options.preview ?? parseProductionPreviewConfig({}, { isPackaged: options.isPackaged });
  const sorted = sortDisplays(displays);
  const used = new Set<number>();
  const exactMatches: Array<{ monitor: MonitorLayoutEntry; display: Display | null }> = [];

  for (const monitor of layout.monitors) {
    const configRect: Rect = {
      x: monitor.x,
      y: monitor.y,
      width: monitor.width,
      height: monitor.height,
    };
    const found = sorted.find(
      (display) => !used.has(display.id) && rectsWithinTolerance(displayRect(display), configRect, tolerance),
    );
    if (found) used.add(found.id);
    exactMatches.push({ monitor, display: found ?? null });
  }

  const unmatched = exactMatches.filter((row) => row.display == null);
  const boundsMismatch = unmatched.length > 0;
  const leftover = sorted.filter((display) => !used.has(display.id));

  if (boundsMismatch) {
    for (const row of unmatched) {
      warnings.push(
        `bounds mismatch monitorId=${row.monitor.monitorId} config=${row.monitor.x},${row.monitor.y} ${row.monitor.width}x${row.monitor.height}`,
      );
    }
  }

  const primary = sorted[0];
  if (preview.mode !== 'off' && !options.isPackaged && primary) {
    return buildPreviewPlacement(layout, preview, primary, sorted, fatal, warnings);
  }

  if (boundsMismatch && fatal) {
    return {
      isDevFallback: false,
      ...emptyPreview(),
      boundsMismatch: true,
      fatalOnBoundsMismatch: true,
      shouldQuit: true,
      quitReason: `fatalOnBoundsMismatch=true and ${unmatched.length} monitor(s) did not match OS display bounds (tolerance ${tolerance}px)`,
      managementDisplayIds: leftover.map((d) => d.id),
      windows: layout.monitors.map((monitor) => ({
        monitorId: monitor.monitorId,
        bounds: { x: monitor.x, y: monitor.y, width: monitor.width, height: monitor.height },
        config: monitor,
        matchedDisplayId: null,
        boundsMismatch: true,
      })),
      warnings,
    };
  }

  if (!boundsMismatch) {
    warnings.push(`monitor layout matched ${layout.monitors.length} display(s) within ${tolerance}px`);
    leftover.forEach((display) => {
      warnings.push(
        `management display excluded id=${display.id} ${display.bounds.width}x${display.bounds.height} @${display.bounds.x},${display.bounds.y}`,
      );
    });
    return {
      isDevFallback: false,
      ...emptyPreview(),
      boundsMismatch: false,
      fatalOnBoundsMismatch: fatal,
      shouldQuit: false,
      quitReason: null,
      managementDisplayIds: leftover.map((d) => d.id),
      windows: exactMatches.map((row) => {
        const display = row.display!;
        return {
          monitorId: row.monitor.monitorId,
          bounds: displayRect(display),
          config: row.monitor,
          matchedDisplayId: display.id,
          boundsMismatch: false,
        };
      }),
      warnings,
    };
  }

  if (sorted.length >= 4) {
    const assigned = sorted.slice(0, 4);
    const management = sorted.slice(4);
    warnings.push(
      `using 4 physical displays by OS order (x,y); config coordinates did not match (not a 1-screen tiled fallback)`,
    );
    management.forEach((display) => {
      warnings.push(
        `management display excluded id=${display.id} ${display.bounds.width}x${display.bounds.height} @${display.bounds.x},${display.bounds.y}`,
      );
    });
    return {
      isDevFallback: false,
      ...emptyPreview(),
      boundsMismatch: true,
      fatalOnBoundsMismatch: fatal,
      shouldQuit: false,
      quitReason: null,
      managementDisplayIds: management.map((d) => d.id),
      windows: layout.monitors.map((monitor, index) => {
        const display = assigned[index]!;
        return {
          monitorId: monitor.monitorId,
          bounds: displayRect(display),
          config: monitor,
          matchedDisplayId: display.id,
          boundsMismatch: true,
        };
      }),
      warnings,
    };
  }

  if (!primary) {
    return {
      isDevFallback: true,
      ...emptyPreview(),
      boundsMismatch: true,
      fatalOnBoundsMismatch: fatal,
      shouldQuit: true,
      quitReason: 'no OS displays reported',
      managementDisplayIds: [],
      windows: [],
      warnings: [...warnings, 'no OS displays reported'],
    };
  }

  const area: Rect = options.isPackaged
    ? displayRect(primary)
    : {
        x: primary.workArea.x,
        y: primary.workArea.y,
        width: primary.workArea.width,
        height: primary.workArea.height,
      };

  warnings.push(
    `dev fallback: tiling 4 windows on display id=${primary.id} ${area.width}x${area.height} @${area.x},${area.y}`,
  );

  return {
    isDevFallback: true,
    ...emptyPreview(),
    boundsMismatch: true,
    fatalOnBoundsMismatch: fatal,
    shouldQuit: false,
    quitReason: null,
    managementDisplayIds: sorted.filter((d) => d.id !== primary.id).map((d) => d.id),
    windows: layout.monitors.map((monitor) => ({
      monitorId: monitor.monitorId,
      bounds: tileDevFallback(area, monitor.monitorId),
      config: monitor,
      matchedDisplayId: primary.id,
      boundsMismatch: true,
    })),
    warnings,
  };
}
