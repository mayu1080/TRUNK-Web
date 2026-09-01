/** Dev-only production preview. Packaged builds always ignore this. */

export type ProductionPreviewMode = 'off' | 'portrait' | 'fullhd';
export type ProductionPreviewWindows = 'single' | 'multi';

export interface ProductionPreviewConfig {
  mode: ProductionPreviewMode;
  windows: ProductionPreviewWindows;
  requestedScale: number | null;
  frame: boolean;
}

const SCALE_MIN = 0.15;
const SCALE_MAX = 1;

function parseMode(raw: string): ProductionPreviewMode {
  const value = raw.trim().toLowerCase();
  if (!value || value === '0' || value === 'false' || value === 'off' || value === 'none') return 'off';
  if (value === 'fullhd' || value === 'landscape' || value === '1920x1080') return 'fullhd';
  if (
    value === '1' ||
    value === 'true' ||
    value === 'portrait' ||
    value === 'fullhd-portrait' ||
    value === '1080x1920'
  ) {
    return 'portrait';
  }
  return 'portrait';
}

function parseWindows(raw: string | undefined): ProductionPreviewWindows {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === 'single' || value === '1' || value === 'one') return 'single';
  if (value === 'multi' || value === '4' || value === 'four') return 'multi';
  return 'multi';
}

function parseScale(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === '') return null;
  const parsed = Number(raw.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, parsed));
}

/** Preview title bar. Default frameless so review QA is not blocked. FRAME=1 restores it. */
function parseFrame(raw: string | undefined): boolean {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === '1' || value === 'true' || value === 'on' || value === 'frame') return true;
  if (value === '0' || value === 'false' || value === 'off' || value === 'frameless' || value === 'none') {
    return false;
  }
  return false;
}

export function parseProductionPreviewConfig(
  env: NodeJS.ProcessEnv,
  options: { isPackaged: boolean },
): ProductionPreviewConfig {
  if (options.isPackaged) {
    return { mode: 'off', windows: 'multi', requestedScale: null, frame: false };
  }
  return {
    mode: parseMode(env.TRUNK_PRODUCTION_PREVIEW_MODE ?? ''),
    windows: parseWindows(env.TRUNK_PRODUCTION_PREVIEW_WINDOWS),
    requestedScale: parseScale(env.TRUNK_PRODUCTION_PREVIEW_SCALE),
    frame: parseFrame(env.TRUNK_PRODUCTION_PREVIEW_FRAME),
  };
}

export function previewLogicalSize(
  mode: Exclude<ProductionPreviewMode, 'off'>,
  layoutWidth: number,
  layoutHeight: number,
): { width: number; height: number } {
  if (mode === 'fullhd') {
    return { width: 1920, height: 1080 };
  }
  return {
    width: layoutWidth > 0 ? layoutWidth : 1080,
    height: layoutHeight > 0 ? layoutHeight : 1920,
  };
}

export function computePreviewScale(
  area: { width: number; height: number },
  logicalWidth: number,
  logicalHeight: number,
  requestedScale: number | null,
  gap = 12,
  cols = 2,
  rows = 2,
): number {
  const availW = Math.max(160, (area.width - gap * (cols + 1)) / cols);
  const availH = Math.max(240, (area.height - gap * (rows + 1)) / rows);
  const fit = Math.min(availW / Math.max(1, logicalWidth), availH / Math.max(1, logicalHeight), 1);
  if (requestedScale == null) return fit;
  return requestedScale;
}

export function choosePreviewGrid(
  area: { width: number; height: number },
  logicalWidth: number,
  logicalHeight: number,
  requestedScale: number | null,
  gap = 12,
  windows: ProductionPreviewWindows = 'multi',
): { cols: number; rows: number; scale: number } {
  if (windows === 'single') {
    return {
      cols: 1,
      rows: 1,
      scale: computePreviewScale(area, logicalWidth, logicalHeight, requestedScale, gap, 1, 1),
    };
  }
  const grids = [
    { cols: 2, rows: 2 },
    { cols: 4, rows: 1 },
    { cols: 1, rows: 4 },
  ];
  if (requestedScale != null) {
    return { cols: 2, rows: 2, scale: requestedScale };
  }
  let best = { cols: 2, rows: 2, scale: 0 };
  for (const grid of grids) {
    const scale = computePreviewScale(area, logicalWidth, logicalHeight, null, gap, grid.cols, grid.rows);
    if (scale > best.scale) best = { ...grid, scale };
  }
  return best;
}
