export const IMAGE_ZOOM_MOTION = {
  durationMs: 280,
  easing: [0.22, 1, 0.36, 1] as const,
  initial: { opacity: 0, scale: 0.94 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
};

export const DRAWER_MOTION = {
  widthPx: 320,
  durationMs: 320,
  easing: [0.32, 0.72, 0, 1] as const,
  showScrimDefault: true,
  initial: { x: '100%' as const, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: '100%' as const, opacity: 0 },
};

export const SCRIM_MOTION = {
  durationMs: 260,
  easing: [0.22, 1, 0.36, 1] as const,
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

/** 展示端末向け — 背景タップで閉じる */
export const CLOSE_ON_BACKDROP_DEFAULT = true;

export const MOCK_CATEGORIES = [
  { id: 'food', label: 'Food' },
  { id: 'gift', label: 'Gift' },
  { id: 'flower', label: 'Flower' },
] as const;

export type OverlayState = 'normal' | 'image-zoom-open' | 'drawer-open';
