/** demo-0820 が preload 経由で使う型。本番 shared と同じ ID。 */

export type ScreenState =
  | 'TOP'
  | 'ANIMATION'
  | 'PRODUCT_LIST'
  | 'IMAGE_ZOOM'
  | 'PRODUCT_DETAIL';

export interface MonitorState {
  monitorId: number;
  screenState: ScreenState;
  uiState: { categoryDrawer: 'open' | 'closed' };
  selectedCategoryId: string | null;
  selectedListImageId: string | null;
}

export interface AppConfig {
  contentRoot: string;
  isPackaged: boolean;
  monitorId: number;
  monitorCount: number;
  idleTimeoutSeconds: number;
  idleTimeoutSource: 'production' | 'development';
}

export type StateAction =
  | { type: 'TOP_ENTRY_TAP' }
  | { type: 'ANIMATION_COMPLETE' }
  | { type: 'LIST_IMAGE_TAP'; imageId?: string }
  | { type: 'IMAGE_ZOOM_CLOSE' }
  | { type: 'CATEGORY_DRAWER_OPEN' }
  | { type: 'CATEGORY_DRAWER_CLOSE' }
  | { type: 'CATEGORY_SELECT'; categoryId: string }
  | { type: 'PRODUCT_DETAIL_CLOSE' }
  | { type: 'IDLE_TIMEOUT' };
