export interface Manifest {
  version: string;
  updatedAt: string;
  categoriesFile: string;
  productsFile: string;
  assetBaseDir: string;
  defaultListImageDir: string;
  cmVideoDir?: string;
}

export interface Category {
  id: string;
  label: string;
  title?: string;
  description?: string;
  imageDir: string;
  order: number;
  /** Explicit folder order under imageDir. Disk folders not listed are skipped. ASCII ids. */
  contentFolders?: string[];
  /** Display names for contentFolders (Japanese OK). Missing keys use the folder id. */
  contentFolderLabels?: Record<string, string>;
  /** Food: opening 表紙 once, then coverDir/{folder} before each course. Gift/Flower stay false for now. */
  insertCoverBetweenFolders?: boolean;
  coverDir?: string;
}

export interface Product {
  id: string;
  categoryId: string;
  title: string;
  subtitle?: string;
  description?: string;
  images: string[];
  thumbnail?: string;
  tags?: string[];
}

export interface ListImageEntry {
  id: string;
  relativePath: string;
  fileName: string;
}

export interface ExploreImageEntry extends ListImageEntry {
  categoryId?: string;
  title?: string;
}

export interface ExploreImageSet {
  source: 'listImages' | 'recursive-images';
  images: ExploreImageEntry[];
}

export interface AssetIndex {
  version: string;
  updatedAt: string;
  contentRoot: string;
  listImages: ListImageEntry[];
  categories: Category[];
  products: Product[];
  warnings: string[];
}

export type ContentValidationLevel = 'warning' | 'strong-warning';

export interface ContentValidationIssue {
  level: ContentValidationLevel;
  code: string;
  message: string;
  relativePath?: string;
}

export interface ContentImageValidationReport {
  contentRoot: string;
  contentRootExists: boolean;
  imagesDirExists: boolean;
  listDirExists: boolean;
  categoriesPresent: boolean;
  contentLogoDirPresent: boolean;
  exploreSource: ExploreImageSet['source'] | 'none';
  listDirImageCount: number;
  recursiveImageCount: number;
  sourceImageCount: number;
  supportedCount: number;
  legacyCount: number;
  unsupportedFileCount: number;
  duplicateIdCount: number;
  filenameWarningCount: number;
  sizeWarningCount: number;
  strongSizeWarningCount: number;
  fileSizeWarningCount: number;
  categoryIdAssignedCount: number;
  expectedDisplayedCount: number;
  targetCardCount: number;
  validationWarningCount: number;
  issues: ContentValidationIssue[];
  /** Phase 6: production content wiring facts (warnings, not fatal). */
  foodDirExists: boolean;
  foodFolderCount: number;
  foodFolderNames: string[];
  categoryFoodSlideCount: number;
  coverDirExists: boolean;
  coverImageCount: number;
  textDirExists: boolean;
  textLoaded: boolean;
  textSource: string | null;
  animationDirExists: boolean;
  animationVideoMode: 'single-shared' | 'per-monitor' | 'missing';
  animationVideoFiles: string[];
  adsDirExists: boolean;
  /** `split` = monitor-1..4.mp4 が 4 本そろっている（素材側で 4 分割済み） */
  adsVideoMode: 'split' | 'per-monitor' | 'single-shared' | 'missing';
  adsVideoFiles: string[];
  adsVideoDurationMs: number;
  fontsDirExists: boolean;
  fontFileCount: number;
}

export interface AppConfig {
  contentRoot: string;
  isPackaged: boolean;
  monitorId: number;
  monitorCount: number;
  /** 無操作スリープ秒数（本番 600 / 開発は TRUNK_IDLE_TIMEOUT_SECONDS で上書き可） */
  idleTimeoutSeconds: number;
  idleTimeoutSource: 'production' | 'development';
}

export interface LogEvent {
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, unknown>;
}

import type { MonitorState, CategoryDrawerState, ScreenState, UiState } from './state';
import type { StateAction } from './transitions';
import type { ProductionAction, ProductionDump, ProductionSnapshot } from './productionState';

export type { MonitorState, ScreenState, UiState, CategoryDrawerState } from './state';
export type { StateAction } from './transitions';
export type { ProductionAction, ProductionDump, ProductionSnapshot } from './productionState';

export interface CategoryGalleryImage {
  id: string;
  relativePath: string;
  fileName: string;
  title: string;
  description: string;
  url: string;
  kind: 'cover' | 'content';
  contentFolder: string | null;
  courseName: string | null;
}

export interface CategoryGallery {
  category: Category;
  images: CategoryGalleryImage[];
  warnings: string[];
}

export interface SharedCopy {
  found: boolean;
  relativePath: string;
  title: string;
  description: string;
  warning: string | null;
}

export interface LogoAsset {
  found: boolean;
  fileName: string | null;
  url: string | null;
  logoRoot: string;
}

export interface NoiseAsset {
  found: boolean;
  fileName: string | null;
  relativePath: string | null;
  url: string | null;
  dirPresent: boolean;
  warning: string | null;
}

export interface BrandFontFace {
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
  faces: BrandFontFace[];
  skipped: string[];
  warning: string | null;
}

export interface TrunkApi {
  getConfig(): Promise<AppConfig>;
  getManifest(): Promise<Manifest>;
  getCategories(): Promise<Category[]>;
  getProducts(): Promise<Product[]>;
  getAssetIndex(): Promise<AssetIndex>;
  getExploreImages(): Promise<ExploreImageSet>;
  getContentFileUrl(relativePath: string): Promise<string>;
  getContentImageValidation(): Promise<ContentImageValidationReport>;
  getCategoryGallery(categoryId: string): Promise<CategoryGallery>;
  getSharedCopy(): Promise<SharedCopy>;
  getLogoAsset(): Promise<LogoAsset>;
  getNoiseAsset(): Promise<NoiseAsset>;
  getBrandFonts(): Promise<BrandFontCatalog>;
  logEvent(event: LogEvent): Promise<boolean>;
  getState(): Promise<MonitorState>;
  dispatch(action: StateAction): Promise<MonitorState>;
  onStateChanged(callback: (state: MonitorState) => void): () => void;
  getProductionSnapshot(): Promise<ProductionSnapshot>;
  getProductionDump(): Promise<ProductionDump>;
  dispatchProduction(action: ProductionAction): Promise<ProductionSnapshot>;
  onProductionStateChanged(callback: (snapshot: ProductionSnapshot) => void): () => void;
}

declare global {
  interface Window {
    trunkApi: TrunkApi;
  }
}

export {};
