/** DF — IMAGE_ZOOM / categoryDrawer 用（DD 流用） */

export type EasingBezier = readonly [number, number, number, number];

export const EASE_OUT_CUBIC: EasingBezier = [0.33, 1, 0.68, 1];
export const EASE_DRAWER_IN_QUAD: EasingBezier = [0.32, 0, 0.58, 0.02];
export const EASE_IN_OUT_CUBIC: EasingBezier = [0.645, 0.045, 0.355, 1];
export const EASE_IMAGE_ZOOM_SCRIM: EasingBezier = EASE_IN_OUT_CUBIC;
export const EASE_IMAGE_ZOOM_CARD: EasingBezier = EASE_IN_OUT_CUBIC;

export const IMAGE_ZOOM_CARD_DELAY_FRAMES = 2;
export const IMAGE_ZOOM_CARD_DELAY_MS = Math.round((IMAGE_ZOOM_CARD_DELAY_FRAMES / 60) * 1000);

export const MOTION_CONFIG = {
  imageZoomOpen: {
    enabled: true,
    scrimFadeMs: 180,
    cardDelayMs: IMAGE_ZOOM_CARD_DELAY_MS,
    cardFadeMs: 210,
    scrimOpacityMax: 0.55,
    scrimBlurPx: 14,
    cardScaleFrom: 1,
    cardScaleTo: 1,
    cardTranslateYFrom: 0,
    cardExitTranslateY: 0,
    scrimEasing: EASE_IMAGE_ZOOM_SCRIM,
    cardEasing: EASE_IMAGE_ZOOM_CARD,
  },
  drawer: {
    widthPx: 320,
    openMs: 260,
    closeMs: 230,
    translateFromX: 12,
    opacityFrom: 0,
    opacityTo: 1,
    scrimFadeMs: 220,
    easing: EASE_DRAWER_IN_QUAD,
    showScrimDefault: true,
  },
};

export const IMAGE_ZOOM_MOTION = {
  durationMs: MOTION_CONFIG.imageZoomOpen.cardFadeMs,
  easing: MOTION_CONFIG.imageZoomOpen.cardEasing,
  initial: {
    opacity: 0,
    scale: MOTION_CONFIG.imageZoomOpen.cardScaleFrom,
    y: MOTION_CONFIG.imageZoomOpen.cardTranslateYFrom,
  },
  animate: {
    opacity: 1,
    scale: MOTION_CONFIG.imageZoomOpen.cardScaleTo,
    y: 0,
  },
  exit: {
    opacity: 0,
    scale: MOTION_CONFIG.imageZoomOpen.cardScaleTo,
    y: MOTION_CONFIG.imageZoomOpen.cardExitTranslateY,
  },
};

export const DRAWER_MOTION = {
  widthPx: MOTION_CONFIG.drawer.widthPx,
  durationMs: MOTION_CONFIG.drawer.openMs,
  closeMs: MOTION_CONFIG.drawer.closeMs,
  easing: MOTION_CONFIG.drawer.easing,
  showScrimDefault: MOTION_CONFIG.drawer.showScrimDefault,
  initial: {
    x: MOTION_CONFIG.drawer.translateFromX,
    opacity: MOTION_CONFIG.drawer.opacityFrom,
  },
  animate: { x: 0, opacity: MOTION_CONFIG.drawer.opacityTo },
  exit: {
    x: MOTION_CONFIG.drawer.translateFromX * 0.6,
    opacity: MOTION_CONFIG.drawer.opacityFrom,
  },
};

export const DRAWER_SCRIM_MOTION = {
  durationMs: MOTION_CONFIG.drawer.scrimFadeMs,
  easing: MOTION_CONFIG.drawer.easing,
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const CLOSE_ON_BACKDROP_DEFAULT = true;

export const MOCK_CATEGORIES = [
  { id: 'food', label: 'Food' },
  { id: 'gift', label: 'Gift' },
  { id: 'flower', label: 'Flower' },
] as const;

export type OverlayState = 'normal' | 'image-zoom-open' | 'drawer-open';
