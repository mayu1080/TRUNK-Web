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
  /** 複製エントリの場合 true */
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
}

export interface DebugStats {
  fps: number;
  assetMode: string;
  sourceRoot: string;
  scannedFolders: string;
  includeDirs: string;
  excludeDirs: string;
  realImageCount: number;
  displayedImageCount: number;
  duplicatedCount: number;
  texturesLoaded: number;
  displayMinLongSide: number;
  displayMaxLongSide: number;
  displayAvgLongSide: number;
  maxTargetLongSide: number;
  presetDistribution: string;
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
  overlayOpen: boolean;
}

/** Electron preload 互換（存在時のみ使用） */
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
