/** 本番 AssetIndex.listImages エントリと互換 */
export interface ListImageEntry {
  id: string;
  relativePath: string;
  fileName: string;
}

export interface DemoListImage extends ListImageEntry {
  url: string;
  categoryId?: string;
  sourceFolder?: string;
  duplicated?: boolean;
}

export interface DemoAssetIndex {
  mode: string;
  root: string;
  generatedAt: string;
  totalImages: number;
  folders: string[];
  includeDirs: string[];
  excludeDirs: string[];
  images: DemoListImage[];
  warnings: string[];
}

export interface ExploreView {
  panX: number;
  panY: number;
  zoom: number;
}

export type AssetSource = 'trunkApi' | 'demo-index' | 'mock';

export interface AssetLoadResult {
  images: DemoListImage[];
  warnings: string[];
  source: AssetSource;
  assetMode: string;
  sourceRoot: string;
  scannedFolders: string[];
  includeDirs: string[];
  excludeDirs: string[];
  realImageCount: number;
  displayedImageCount: number;
  duplicatedCount: number;
  selectionSeed: number | null;
}

export interface SelectedImageDebug {
  id: string;
  originalWidth: number;
  originalHeight: number;
  displayedWidth: number;
  displayedHeight: number;
  scale: number;
  preset: string;
  depth: number;
}

export interface DebugStats {
  demoId: 'DD';
  fps: number;
  visualPreset: string;
  tonePreset: string;
  imageBrightness: number;
  imageContrast: number;
  noiseEnabled: boolean;
  noiseOpacity: number;
  depthEnabled: boolean;
  depthLayers: number;
  parallaxStrength: number;
  floatEnabled: boolean;
  floatAmplitude: number;
  touchReactionEnabled: boolean;
  touchReactionStrength: number;
  overlayState: string;
  drawerOpen: boolean;
  pointerBlocked: boolean;
  assetMode: string;
  sourceRoot: string;
  scannedFolders: string;
  realImageCount: number;
  displayedImageCount: number;
  duplicatedCount: number;
  texturesLoaded: number;
  selectedImage: SelectedImageDebug | null;
  panX: number;
  panY: number;
  zoom: number;
  selectedImageId: string | null;
  rendererType: string;
  canvasCount: number;
  warningCount: number;
  drawCallEstimate: number;
  textureMemoryMb: number;
  loadTimeMs: number;
  initTimeMs: number;
  devicePixelRatio: number;
  interactionEnabled: boolean;
  tapLocked: boolean;
  hitTestDebug: HitTestDebugStats | null;
  hitTestDebugEnabled: boolean;
}

export interface HitTestBoundsDebug {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HitTestCandidateDebug {
  imageId: string;
  depth: number;
  layerId: string;
  zIndex: number;
  renderOrder: number;
  bounds: HitTestBoundsDebug;
}

export interface HitTestDebugStats {
  clientDownX: number;
  clientDownY: number;
  clientUpX: number;
  clientUpY: number;
  canvasDownX: number;
  canvasDownY: number;
  canvasUpX: number;
  canvasUpY: number;
  worldDownX: number;
  worldDownY: number;
  worldUpX: number;
  worldUpY: number;
  moveDistancePx: number;
  durationMs: number;
  wasDragging: boolean;
  wasTap: boolean;
  tapRejectedReason: string;
  pointerTarget: string;
  elementsFromPointTop: string;
  domBlocksCanvas: boolean;
  hitCandidateCount: number;
  hitCandidates: HitTestCandidateDebug[];
  chosenImageId: string | null;
  chosenBounds: HitTestBoundsDebug | null;
  chosenAtDownImageId: string | null;
  tapMoveThresholdPx: number;
  tapMaxDurationMs: number;
  panStartThresholdPx: number;
}

export interface TrunkApiLike {
  getAssetIndex(): Promise<{
    listImages: ListImageEntry[];
    warnings: string[];
  }>;
  getContentFileUrl(relativePath: string): Promise<string>;
}

declare global {
  interface Window {
    trunkApi?: TrunkApiLike;
  }
}

export {};
