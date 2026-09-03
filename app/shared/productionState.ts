/** Production Phase 1 state model. Independent from 0820 screenState. */

export const GLOBAL_SCENES = ['AD_IDLE', 'ANIMATION', 'PRODUCT_LIST'] as const;
export type GlobalScene = (typeof GLOBAL_SCENES)[number];

export const LOCAL_OVERLAYS = ['NONE', 'IMAGE_ZOOM', 'CATEGORY_DRAWER', 'CATEGORY_MODAL'] as const;
export type LocalOverlay = (typeof LOCAL_OVERLAYS)[number];

export const AD_MODE = 'four-screen-synced-content' as const;
export type AdMode = typeof AD_MODE;

export interface PerMonitorState {
  monitorId: number;
  localOverlay: LocalOverlay;
  selectedImageId: string | null;
  selectedCategoryId: string | null;
  interactionLocked: boolean;
}

export interface MonitorLayoutEntry {
  monitorId: number;
  x: number;
  y: number;
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
  viewportOffsetX: number;
  viewportOffsetY: number;
  scale: number;
}

export interface MonitorLayoutFile {
  boundsTolerancePx: number;
  fatalOnBoundsMismatch: boolean;
  monitors: MonitorLayoutEntry[];
}

export interface MonitorLayoutInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  orientation: MonitorLayoutEntry['orientation'];
  viewportOffsetX: number;
  viewportOffsetY: number;
  scale: number;
  windowBounds: { x: number; y: number; width: number; height: number };
  configBounds: { x: number; y: number; width: number; height: number };
  matchedDisplayId: number | null;
}

export interface ProductionMonitorSummary {
  monitorId: number;
  localOverlay: LocalOverlay;
  interactionLocked: boolean;
  selectedImageId: string | null;
  selectedCategoryId: string | null;
}

export interface VideoTrackInfo {
  monitorId: number;
  relativePath: string;
  url: string | null;
  found: boolean;
}

export interface VideoSessionInfo {
  scene: 'AD_IDLE' | 'ANIMATION' | 'none';
  contentId: string;
  sessionId: number;
  startedAtMs: number;
  durationMs: number;
  loop: boolean;
  skipOnTouch: boolean;
  track: VideoTrackInfo;
}

export interface IdleDebugInfo {
  timeoutSeconds: number;
  source: 'production' | 'development';
  armed: boolean;
  lastValidTouchAtMs: number | null;
}

export interface ProductionSnapshot {
  globalScene: GlobalScene;
  adMode: AdMode;
  monitorId: number;
  own: PerMonitorState;
  monitors: ProductionMonitorSummary[];
  layout: MonitorLayoutInfo;
  video: VideoSessionInfo;
  idle: IdleDebugInfo;
  debug: {
    isDevFallback: boolean;
    isPreviewMode: boolean;
    previewMode: 'off' | 'portrait' | 'fullhd';
    previewWindows: 'off' | 'single' | 'multi';
    previewScale: number | null;
    previewLogicalWidth: number | null;
    previewLogicalHeight: number | null;
    boundsMismatch: boolean;
    fatalOnBoundsMismatch: boolean;
    contentRoot: string;
    layoutPath: string;
    warnings: string[];
  };
}

export interface ProductionDump {
  globalScene: GlobalScene;
  adMode: AdMode;
  isDevFallback: boolean;
  isPreviewMode: boolean;
  previewMode: 'off' | 'portrait' | 'fullhd';
  previewWindows: 'off' | 'single' | 'multi';
  previewScale: number | null;
  boundsMismatch: boolean;
  fatalOnBoundsMismatch: boolean;
  layoutPath: string;
  warnings: string[];
  video: Omit<VideoSessionInfo, 'track'> & { tracksFound: number };
  idle: IdleDebugInfo;
  monitors: ProductionMonitorSummary[];
}

export type ProductionAction =
  | { type: 'SET_GLOBAL_SCENE'; scene: GlobalScene }
  | { type: 'AD_IDLE_TOUCH' }
  | { type: 'ANIMATION_COMPLETE' }
  | { type: 'GLOBAL_IDLE_TIMEOUT' }
  | { type: 'REPORT_TOUCH_ACTIVITY' }
  | { type: 'OPEN_IMAGE_ZOOM'; imageId?: string }
  | { type: 'OPEN_CATEGORY_DRAWER' }
  | { type: 'OPEN_CATEGORY_MODAL'; categoryId?: string }
  | { type: 'CLOSE_OVERLAY' };

export function createInitialPerMonitorState(monitorId: number): PerMonitorState {
  return {
    monitorId,
    localOverlay: 'NONE',
    selectedImageId: null,
    selectedCategoryId: null,
    interactionLocked: false,
  };
}

export function withOverlayLock(state: PerMonitorState): PerMonitorState {
  return {
    ...state,
    interactionLocked: state.localOverlay !== 'NONE',
  };
}

export function isGlobalScene(value: string): value is GlobalScene {
  return (GLOBAL_SCENES as readonly string[]).includes(value);
}

export function isLocalOverlay(value: string): value is LocalOverlay {
  return (LOCAL_OVERLAYS as readonly string[]).includes(value);
}
