/** Production PRODUCT_LIST knobs. Shared seed/count with 0820; per-window clone uses this same config. */

export const listConfig = {
  bubbleEnabled: true,
  bubbleSizePx: 160,
  revealRadiusPx: 80,
  bubbleFollowSmoothing: 0.18,
  bubbleHideDelayMs: 600,

  listMotionSpeed: 2.6,
  cameraDollySpeed: 2.6,
  cameraSmoothing: 1.0,

  dollyCruiseEnabled: true,
  pinchDollyScale: 2.4,

  tapMaxMovePx: 16,
  tapMaxDurationMs: 600,
  hitTestMinAlpha: 0.1,

  useDuplicatedCards: true,
  /** Keep in sync with app/shared/contentImageRules.ts TARGET_LIST_CARD_COUNT */
  targetCardCount: 96,
  densityPreset: 'dense-96',
  cardExpandSeed: 1234,

  rendererPixelRatioMax: 2,

  /** Phase 5.5: prefer content/noise/*.mp4. DOM grain is fallback. */
  noiseEnabled: true,
  noiseOpacity: 0.48,
  noiseTileSize: 200,
  noiseBlendMode: 'soft-light' as const,
  noiseApplyToList: true,
  noiseApplyToImageZoom: true,
  noiseApplyToCategoryModal: true,

  /** Session centroid travel before vertical dolly arms. Per-frame jitter still needs > 1.5px. */
  twoFingerVerticalDeadZonePx: 10,
} as const;

export type ListConfig = typeof listConfig;
