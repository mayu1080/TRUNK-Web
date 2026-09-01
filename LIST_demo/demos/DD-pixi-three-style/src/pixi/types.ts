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
  demoId: 'DD' | 'DE';
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
  idleMotionEnabled: boolean;
  idleSampleY: number;
  idleSampleRotDeg: number;
  depthFlowEnabled: boolean;
  depthFlowMode: string;
  objectFlowActive: boolean;
  flowSpeedControlEnabled: boolean;
  parallaxMode: string;
  cameraZ: number;
  targetCameraZ: number;
  cameraZVelocity: number;
  sceneTimeScale: number;
  targetSceneTimeScale: number;
  sceneTimeWheelBoost: boolean;
  effectiveSceneDriftSpeed: number;
  minCameraZ: number;
  maxCameraZ: number;
  cameraWheelSensitivity: number;
  depthFlowBaseSpeed: number;
  depthFlowSpeedMultiplier: number;
  depthFlowSpeedDirection: number;
  depthFlowWheelBoost: boolean;
  depthFlowWheelDeltaX: number;
  depthFlowWheelDeltaY: number;
  depthFlowWheelAxis: string;
  depthFlowEffectiveSpeed: number;
  depthFlowMinSpeedMultiplier: number;
  depthFlowMaxSpeedMultiplier: number;
  depthFlowRespawnCount: number;
  depthFlowSpeed: number;
  depthFlowSampleDepth: number;
  depthFlowSampleLabel: string;
  depthFlowSampleRenderOrder: number;
  layerReparentCount: number;
  selectedFlowDepth: number | null;
  selectedSceneZ: number | null;
  selectedRelativeZ: number | null;
  selectedPerspective: number | null;
  selectedImageDepth: number | null;
  selectedRelativeDepth: number | null;
  selectedDepthLabel: string | null;
  selectedRenderOrder: number | null;
  selectedFlowSpeed: number | null;
  selectedAlpha: number | null;
  selectedScale: number | null;
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
  alpha: number;
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
  hitTestExecuted: boolean;
  pointerTarget: string;
  elementsFromPointTop: string;
  domBlocksCanvas: boolean;
  candidatesBeforeFilter: number;
  candidatesAfterVisibility: number;
  candidatesAfterAlpha: number;
  candidatesFinal: number;
  hitCandidateCount: number;
  hitCandidates: HitTestCandidateDebug[];
  chosenImageId: string | null;
  chosenRenderOrder: number | null;
  chosenAlpha: number | null;
  chosenBounds: HitTestBoundsDebug | null;
  chosenAtDownImageId: string | null;
  tapMoveThresholdPx: number;
  tapMaxDurationMs: number;
  panStartThresholdPx: number;
  canvasRectLeft: number;
  canvasRectTop: number;
  canvasRectWidth: number;
  canvasRectHeight: number;
  rendererResolution: number;
  tapLocked: boolean;
  cooldownRemainingMs: number;
  overlayBlocking: boolean;
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
