import type { Display } from 'electron';
import type { GlobalScene, VideoTrackInfo } from '../../shared/productionState';
import type { WindowPlacementResult } from './windowPlacement';

export interface ManagementDisplayRow {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
  workAreaX: number;
  workAreaY: number;
  workAreaWidth: number;
  workAreaHeight: number;
  internal: boolean;
  role: 'production' | 'management' | 'unused';
  productionMonitorIds: number[];
}

export interface ManagementTrackRow {
  monitorId: number;
  relativePath: string;
  found: boolean;
}

export interface ManagementStatus {
  globalScene: GlobalScene;
  isDevFallback: boolean;
  isPreviewMode: boolean;
  boundsMismatch: boolean;
  contentRoot: string;
  layoutPath: string;
  displays: ManagementDisplayRow[];
  productionWindows: Array<{
    monitorId: number;
    displayId: number | null;
    windowId: number | null;
    x: number;
    y: number;
    width: number;
    height: number;
    configX: number;
    configY: number;
    configWidth: number;
    configHeight: number;
    boundsMismatch: boolean;
  }>;
  mappingFlags: {
    sharedDisplayId: boolean;
    identicalBounds: boolean;
  };
  lastTouch: {
    windowId: number | null;
    monitorId: number | null;
    displayId: number | null;
    eventType: string | null;
  } | null;
  observationLogPath: string | null;
  managementDisplayIds: number[];
  ads: { contentId: string; foundCount: number; tracks: ManagementTrackRow[] };
  animation: { contentId: string; foundCount: number; tracks: ManagementTrackRow[] };
  warnings: string[];
}

function tracksOf(tracks: VideoTrackInfo[]): ManagementTrackRow[] {
  return tracks.map((track) => ({
    monitorId: track.monitorId,
    relativePath: track.relativePath,
    found: track.found,
  }));
}

export function buildManagementStatus(input: {
  displays: Display[];
  placement: WindowPlacementResult;
  globalScene: GlobalScene;
  contentRoot: string;
  layoutPath: string;
  adsContentId: string;
  adsTracks: VideoTrackInfo[];
  animationContentId: string;
  animationTracks: VideoTrackInfo[];
  windowIds?: Map<number, number | null>;
  lastTouch?: {
    windowId: number | null;
    monitorId: number | null;
    displayId: number | null;
    eventType: string | null;
  } | null;
  observationLogPath?: string | null;
}): ManagementStatus {
  const productionByDisplay = new Map<number, number[]>();
  for (const row of input.placement.windows) {
    if (row.matchedDisplayId == null) continue;
    const list = productionByDisplay.get(row.matchedDisplayId) ?? [];
    list.push(row.monitorId);
    productionByDisplay.set(row.matchedDisplayId, list);
  }
  const managementSet = new Set(input.placement.managementDisplayIds);

  const displays = [...input.displays]
    .sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y || a.id - b.id)
    .map((display) => {
      const productionMonitorIds = (productionByDisplay.get(display.id) ?? []).sort((a, b) => a - b);
      let role: ManagementDisplayRow['role'] = 'unused';
      if (productionMonitorIds.length > 0) role = 'production';
      else if (managementSet.has(display.id)) role = 'management';
      return {
        id: display.id,
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height,
        scaleFactor: display.scaleFactor,
        workAreaX: display.workArea.x,
        workAreaY: display.workArea.y,
        workAreaWidth: display.workArea.width,
        workAreaHeight: display.workArea.height,
        internal: Boolean(display.internal),
        role,
        productionMonitorIds,
      };
    });

  const productionWindows = input.placement.windows.map((row) => ({
    monitorId: row.monitorId,
    displayId: row.matchedDisplayId,
    windowId: input.windowIds?.get(row.monitorId) ?? null,
    x: row.bounds.x,
    y: row.bounds.y,
    width: row.bounds.width,
    height: row.bounds.height,
    configX: row.config.x,
    configY: row.config.y,
    configWidth: row.config.width,
    configHeight: row.config.height,
    boundsMismatch: row.boundsMismatch,
  }));
  const displayIds = productionWindows.map((row) => row.displayId).filter((id): id is number => id != null);
  const boundKeys = productionWindows.map((row) => `${row.x},${row.y},${row.width}x${row.height}`);

  return {
    globalScene: input.globalScene,
    isDevFallback: input.placement.isDevFallback,
    isPreviewMode: input.placement.isPreviewMode,
    boundsMismatch: input.placement.boundsMismatch,
    contentRoot: input.contentRoot,
    layoutPath: input.layoutPath,
    displays,
    productionWindows,
    mappingFlags: {
      sharedDisplayId: displayIds.length > 1 && new Set(displayIds).size < displayIds.length,
      identicalBounds: boundKeys.length > 1 && new Set(boundKeys).size < boundKeys.length,
    },
    lastTouch: input.lastTouch ?? null,
    observationLogPath: input.observationLogPath ?? null,
    managementDisplayIds: [...input.placement.managementDisplayIds],
    ads: {
      contentId: input.adsContentId,
      foundCount: input.adsTracks.filter((t) => t.found).length,
      tracks: tracksOf(input.adsTracks),
    },
    animation: {
      contentId: input.animationContentId,
      foundCount: input.animationTracks.filter((t) => t.found).length,
      tracks: tracksOf(input.animationTracks),
    },
    warnings: [...input.placement.warnings],
  };
}

export function pickManagementWindowBounds(
  displays: Display[],
  managementDisplayIds: number[],
): { x: number; y: number; width: number; height: number } | null {
  const leftover = displays.filter((display) => managementDisplayIds.includes(display.id));
  if (leftover.length === 0) return null;
  leftover.sort(
    (a, b) => b.workArea.width * b.workArea.height - a.workArea.width * a.workArea.height,
  );
  const area = leftover[0]!.workArea;
  return {
    x: area.x + 24,
    y: area.y + 24,
    width: Math.max(480, Math.min(960, area.width - 48)),
    height: Math.max(420, Math.min(780, area.height - 48)),
  };
}
