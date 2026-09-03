export type CardGenerationMode = 'content' | 'content-duplicated' | 'fallback-placeholder';

export type ContentLoadStatus = 'idle' | 'loading' | 'loaded' | 'error' | 'fallback';

export type FileProtocolTextureLoadResult =
  | 'pending'
  | 'file-ok'
  | 'file-failed'
  | 'custom-protocol-ok'
  | 'custom-protocol-failed'
  | 'mixed'
  | 'not-attempted';

export type DemoListCard = {
  instanceId: string;
  sourceImageId: string;
  displayIndex: number;
  imageUrl: string;
  relativePath?: string;
  duplicated: boolean;
  categoryId?: string;
  title?: string;
};

export type SelectedDemoCard = {
  instanceId: string;
  sourceImageId: string;
  displayIndex: number;
  imageUrl: string;
  relativePath?: string;
  title?: string;
  categoryId?: string;
};

export type ImageZoomLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

export type DollyWheelMode = 'normal' | 'dolly-cruise';

export type DollyInputSource = 'wheel' | 'shift-wheel' | 'pinch' | 'two-finger-vertical' | 'none';

export interface BubbleRuntimeState {
  enabled: boolean;
  visible: boolean;
  allowed: boolean;
  screenX: number;
  screenY: number;
  sizePx: number;
  revealRadiusPx: number;
  pointerType: string;
  revealCenterNdcX: number;
  revealCenterNdcY: number;
  revealActive: boolean;
}

export interface ListDebugStats {
  canvasMounted: boolean;
  canvasCount: number;
  canvasCssWidth: number;
  canvasCssHeight: number;
  drawingBufferWidth: number;
  drawingBufferHeight: number;
  rendererPixelRatio: number;
  fps: number;
  meshCount: number;
  textureCount: number;

  realImageCount: number;
  sourceImageCount: number;
  displayedImageCount: number;
  duplicatedCount: number;
  textureLoadedCount: number;
  textureFailedCount: number;
  contentLoadStatus: ContentLoadStatus;
  firstImageUrlScheme: string;
  fileProtocolTextureLoadResult: FileProtocolTextureLoadResult;
  cardGenerationMode: CardGenerationMode;
  contentError: string | null;
  exploreSource: 'listImages' | 'recursive-images' | 'none';
  contentRoot: string | null;
  firstImageUrl: string | null;
  wrapCount: number;
  panHardClamp: boolean;

  /** Phase 7.1: monitor ごとの独立 LIST world */
  listWorldMode: 'independent' | 'sharedWall';
  worldSeed: number;
  worldWidth: number;
  worldHeight: number;
  worldScaleMultiplierX: number;
  worldScaleMultiplierY: number;
  worldReferenceDistance: number;
  viewportWorldWidth: number;
  viewportWorldHeight: number;
  cardSpawnSpanX: number;
  cardSpawnSpanY: number;
  targetCardCount: number;
  panWrapCountX: number;
  panWrapCountY: number;
  windowInnerWidth: number;
  windowInnerHeight: number;
  cameraAspect: number;

  cameraXMin: number;
  cameraXMax: number;
  cameraYMin: number;
  cameraYMax: number;

  cameraX: number;
  cameraY: number;
  cameraZ: number;
  targetCameraX: number;
  targetCameraY: number;
  targetCameraZ: number;
  cameraZMin: number;
  cameraZMax: number;
  targetCameraZAtMin: boolean;
  targetCameraZAtMax: boolean;
  cardZMin: number;
  cardZMax: number;

  pointerType: string;
  isDragging: boolean;
  isPinching: boolean;
  wheelMode: DollyWheelMode;
  shiftWheelActive: boolean;
  dollyCruiseEnabled: boolean;
  dollyVelocity: number;
  dollyImpulse: number;
  dollySmoothing: number;
  dollyFriction: number;
  dollyImpulseScale: number;
  pinchActive: boolean;
  activePointerCount: number;
  pinchDistance: number;
  pinchDelta: number;
  pinchDollyScale: number;
  lastDollyInput: DollyInputSource;
  tapSuppressedByPinch: boolean;
  selectedInstanceId: string | null;
  selectedSourceImageId: string | null;
  selectedDisplayIndex: number | null;
  selectedImageUrl: string | null;
  selectedRelativePath: string | null;
  selectedTitle: string | null;
  selectedCategoryId: string | null;
  chosenImageId: string | null;
  raycastCandidateCount: number;

  imageZoomOpen: boolean;
  exploreHostMounted: boolean;
  exploreInteractionEnabled: boolean;
  imageZoomLoadStatus: ImageZoomLoadStatus;
  cardLongSide: number;
  cardScaleMin: number;
  cardScaleMax: number;
  cameraFov: number;
  initialCameraZ: number;
  sceneSpreadX: number;
  sceneSpreadY: number;
  sceneSpreadZ: number;

  bubbleEnabled: boolean;
  bubbleVisible: boolean;
  bubbleAllowed: boolean;
  bubbleSizePx: number;
  revealRadiusPx: number;
  bubbleFollowSmoothing: number;
  revealActive: boolean;
  revealCenterNdcX: number;
  revealCenterNdcY: number;
  bubbleScreenX: number;
  bubbleScreenY: number;
  densityPreset: string;
  nearFadeStartDist: number;
  nearFadeEndDist: number;
  nearScaleStartDistUsed: boolean;
  nearScaleMinUsed: boolean;
  maxScaleClamp: number;
  maxApparentScaleDist: number;
  nearFadeAlpha: number;

  monitorId: number;
  viewportOffsetX: number;
  viewportOffsetY: number;
  layoutScale: number;
  orientation: 'portrait' | 'landscape';
  layoutWidth: number;
  layoutHeight: number;
  devicePixelRatio: number;
  contextLost: boolean;
}
