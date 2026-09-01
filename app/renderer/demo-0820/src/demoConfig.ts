/** 8/20 demo 現場調整用。Phase 1 では Debug 表示と後続 Phase の参照元。 */

export const DEMO_PHASE = 8;

export const demoConfig = {
  demoMode: true,
  forceSingleMonitor: true,

  reviewMode: true,
  debugHudEnabled: true,
  simpleControlPanelEnabled: false,

  bubbleEnabled: true,
  bubbleSizePx: 320,
  revealRadiusPx: 160,
  bubbleFollowSmoothing: 0.18,
  bubbleHideDelayMs: 600,

  listMotionSpeed: 1.0,
  cameraDollySpeed: 1.0,
  cameraSmoothing: 1.0,

  dollyCruiseEnabled: true,
  pinchDollyScale: 1.0,

  tapMaxMovePx: 16,
  tapMaxDurationMs: 600,
  hitTestMinAlpha: 0.1,

  categoryDrawerEnabled: true,
  productDetailPlaceholderEnabled: true,

  useDuplicatedCards: true,
  targetCardCount: 70,

  rendererPixelRatioMax: 2,
} as const;

export type DemoConfig = typeof demoConfig;
