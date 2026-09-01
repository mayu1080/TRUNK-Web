export interface ListImageEntry {
  id: string;
  relativePath: string;
  fileName: string;
}

export interface DemoListImage extends ListImageEntry {
  url: string;
  duplicated: boolean;
  categoryId?: string;
  sourceFolder?: string;
}

export interface DemoAssetIndex {
  mode: string;
  root: string;
  folders: string[];
  includeDirs: string[];
  excludeDirs: string[];
  warnings: string[];
  images: DemoListImage[];
}

export interface AssetLoadResult {
  images: DemoListImage[];
  warnings: string[];
  source: string;
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

export interface DebugStats {
  demoId: 'DF';
  fps: number;
  canvasCount: number;
  rendererType: string;
  imageMeshCount: number;
  textureCount: number;
  cameraX: number;
  cameraY: number;
  cameraZ: number;
  targetCameraX: number;
  targetCameraY: number;
  targetCameraZ: number;
  timelinePosition: number;
  targetTimelinePosition: number;
  cruiseVelocityZ: number;
  cruiseActive: boolean;
  shiftHeld: boolean;
  cameraFov: number;
  visualPreset: string;
  hitTestDebugEnabled: boolean;
  wheelControls: string;
  dragControls: string;
  tapSelection: string;
  raycastCandidateCount: number;
  chosenImageId: string | null;
  chosenDistance: number | null;
  selectedImageId: string | null;
  overlayOpen: boolean;
  drawerOpen: boolean;
  interactionEnabled: boolean;
  realImageCount: number;
  displayedImageCount: number;
  duplicatedCount: number;
  assetMode: string;
  warningCount: number;
}
