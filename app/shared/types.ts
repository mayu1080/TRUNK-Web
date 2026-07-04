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
  description?: string;
  imageDir: string;
  order: number;
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

export interface AssetIndex {
  version: string;
  updatedAt: string;
  contentRoot: string;
  listImages: ListImageEntry[];
  categories: Category[];
  products: Product[];
  warnings: string[];
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

export type { MonitorState, ScreenState, UiState, CategoryDrawerState } from './state';
export type { StateAction } from './transitions';

export interface TrunkApi {
  getConfig(): Promise<AppConfig>;
  getManifest(): Promise<Manifest>;
  getCategories(): Promise<Category[]>;
  getProducts(): Promise<Product[]>;
  getAssetIndex(): Promise<AssetIndex>;
  getContentFileUrl(relativePath: string): Promise<string>;
  logEvent(event: LogEvent): Promise<boolean>;
  getState(): Promise<MonitorState>;
  dispatch(action: StateAction): Promise<MonitorState>;
  onStateChanged(callback: (state: MonitorState) => void): () => void;
}

declare global {
  interface Window {
    trunkApi: TrunkApi;
  }
}

export {};
