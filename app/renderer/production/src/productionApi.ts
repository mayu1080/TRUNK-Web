export type GlobalScene = 'AD_IDLE' | 'ANIMATION' | 'PRODUCT_LIST';
export type LocalOverlay = 'NONE' | 'IMAGE_ZOOM' | 'CATEGORY_DRAWER' | 'CATEGORY_MODAL';

export interface PerMonitorState {
  monitorId: number;
  localOverlay: LocalOverlay;
  selectedImageId: string | null;
  selectedCategoryId: string | null;
  interactionLocked: boolean;
}

export interface MonitorLayoutInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
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
  adMode: string;
  monitorId: number;
  own: PerMonitorState;
  monitors: ProductionMonitorSummary[];
  layout: MonitorLayoutInfo;
  video: VideoSessionInfo;
  idle: IdleDebugInfo;
  debug: {
    isDevFallback: boolean;
    isPreviewMode?: boolean;
    previewMode?: 'off' | 'portrait' | 'fullhd';
    previewWindows?: 'off' | 'single' | 'multi';
    previewScale?: number | null;
    previewLogicalWidth?: number | null;
    previewLogicalHeight?: number | null;
    boundsMismatch: boolean;
    fatalOnBoundsMismatch: boolean;
    contentRoot: string;
    layoutPath: string;
    warnings: string[];
  };
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

export interface ProductionCategory {
  id: string;
  label: string;
  title?: string;
  description?: string;
  imageDir: string;
  order: number;
  contentFolders?: string[];
  contentFolderLabels?: Record<string, string>;
  insertCoverBetweenFolders?: boolean;
  coverDir?: string;
}

export interface CategoryGalleryPayload {
  category: ProductionCategory;
  images: Array<{
    id: string;
    relativePath: string;
    fileName: string;
    title: string;
    description: string;
    url: string;
    kind?: 'cover' | 'content';
    contentFolder?: string | null;
    courseName?: string | null;
  }>;
  warnings?: string[];
}

export interface SharedCopyInfo {
  found: boolean;
  relativePath: string;
  title: string;
  description: string;
  warning: string | null;
}

export interface BrandFontFaceInfo {
  family: string;
  fileName: string;
  relativePath: string;
  url: string;
  weight: number;
  style: 'normal' | 'italic';
  format: 'otf';
  guessed: boolean;
}

export interface BrandFontCatalog {
  family: string;
  format: 'otf';
  dirPresent: boolean;
  faces: BrandFontFaceInfo[];
  skipped: string[];
  warning: string | null;
}

export interface LogoAssetInfo {
  found: boolean;
  fileName: string | null;
  url: string | null;
  logoRoot: string;
}

export interface NoiseAssetInfo {
  found: boolean;
  fileName: string | null;
  relativePath: string | null;
  url: string | null;
  dirPresent: boolean;
  warning: string | null;
}

export interface ContentImageValidationSummary {
  exploreSource: string;
  sourceImageCount: number;
  expectedDisplayedCount: number;
  unsupportedFileCount: number;
  validationWarningCount: number;
  filenameWarningCount: number;
  duplicateIdCount: number;
  categoryIdAssignedCount: number;
  contentLogoDirPresent: boolean;
  categoriesPresent: boolean;
  listDirImageCount: number;
  recursiveImageCount: number;
  foodDirExists?: boolean;
  foodFolderCount?: number;
  foodFolderNames?: string[];
  categoryFoodSlideCount?: number;
  coverDirExists?: boolean;
  coverImageCount?: number;
  textDirExists?: boolean;
  textLoaded?: boolean;
  textSource?: string | null;
  animationDirExists?: boolean;
  animationVideoMode?: 'single-shared' | 'per-monitor' | 'missing';
  animationVideoFiles?: string[];
  adsDirExists?: boolean;
  adsVideoMode?: 'split' | 'per-monitor' | 'single-shared' | 'missing';
  adsVideoFiles?: string[];
  adsVideoDurationMs?: number;
  fontsDirExists?: boolean;
  fontFileCount?: number;
}
