/** screenState — docs/screen-flow.json と一致 */
export const SCREEN_STATES = [
  'TOP',
  'ANIMATION',
  'PRODUCT_LIST',
  'IMAGE_ZOOM',
  'PRODUCT_DETAIL',
] as const;

export type ScreenState = (typeof SCREEN_STATES)[number];

/** PRODUCT_LIST 上の uiState（CATEGORY は独立 screenState ではない） */
export type CategoryDrawerState = 'open' | 'closed';

export interface UiState {
  categoryDrawer: CategoryDrawerState;
}

export interface MonitorState {
  monitorId: number;
  screenState: ScreenState;
  uiState: UiState;
  selectedCategoryId: string | null;
  selectedListImageId: string | null;
}

export const INITIAL_UI_STATE: UiState = { categoryDrawer: 'closed' };

export function createInitialMonitorState(monitorId: number): MonitorState {
  return {
    monitorId,
    screenState: 'TOP',
    uiState: { ...INITIAL_UI_STATE },
    selectedCategoryId: null,
    selectedListImageId: null,
  };
}
