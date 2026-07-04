export interface UiState {
  isImageZoomOpen: boolean;
  isCategoryDrawerOpen: boolean;
  selectedImageId: string | null;
  selectedCategoryId: string | null;
  pointerBlocked: boolean;
  lastAction: string;
}

export type OverlayState =
  | 'normal'
  | 'image-zoom-open'
  | 'image-zoom-closing'
  | 'drawer-open'
  | 'drawer-closing';
