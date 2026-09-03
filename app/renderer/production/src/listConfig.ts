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

  /**
   * Phase 7.1: `independent` は 1 monitor = 1 world（上下左右 wrap）。
   * `sharedWall` は旧 4面1世界（viewportOffset + pan clamp）の退避用。production 既定は independent。
   */
  listWorldMode: 'independent' as 'independent' | 'sharedWall',
  /** world = そのモニターの可視範囲 × 倍率。2 未満にすると wrap 時の最近接複製が破綻する */
  worldScaleMultiplierX: 4,
  worldScaleMultiplierY: 4,
  /** world / 可視範囲を出す奥行き基準距離。CARD_MOTION.farAlphaStartDist と同値 */
  worldReferenceDistance: 2200,
  /** カード出現帯 = 可視範囲 × 倍率。画面あたりのカード密度を決める */
  cardSpawnSpanMultiplier: 2,
  /** monitorId ごとの seed 間隔。1 起動中は固定 */
  worldSeedStride: 10001,

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
