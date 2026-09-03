export const SCENE_LAYOUT = {
  xRange: [-1860, 1860] as const,
  yRange: [-1180, 1180] as const,
  zRange: [-4200, 1800] as const,
  seed: 1234,
};

export const CARD_SCALE_RANGE = { min: 0.72, max: 1.28 } as const;

export const CAMERA_CONFIG = {
  fov: 52,
  near: 10,
  far: 14000,
  initialX: 0,
  initialY: 0,
  initialZ: 1800,
  minZ: 80,
  maxZ: 6400,
  minX: -2000,
  maxX: 2000,
  minY: -1360,
  maxY: 1360,
  wheelSensitivity: 1.15,
  dragSensitivity: 1.35,
  smoothing: 0.12,
  fogDensity: 0.00012,
};

/**
 * Shift+wheel / pinch: Cruise + 慣性ドリー（DI / DF と同値）。
 * 通常 wheel とは別系統。ワールドサイズは変更しない。
 */
export const DOLLY_CRUISE = {
  impulsePer100px: 520,
  maxSpeed: 1600,
  coastFriction: 1.15,
  releaseBrake: 3.8,
  scrubCancelBrake: 8,
  infiniteLoop: true,
  poseSmoothingCruise: 0.2,
  fovWidenAtFullSpeed: 3.2,
  fovSmoothing: 0.07,
  deadZone: 2,
  activeSpeed: 8,
  impulseDeltaCapPx: 160,
} as const;

export const CARD_MOTION = {
  sceneDriftSpeed: 72,
  sceneDriftVariance: 0.18,
  nearFadeStartDist: 1520,
  nearFadeEndDist: 840,
  /** Shrink-to-disappear is off. Keys kept for Debug. */
  nearScaleEnabled: false,
  nearScaleStartDist: 1360,
  nearScaleMin: 0.2,
  /** World scale cap. Apparent size is clamped via maxApparentScaleDist, not a fade shrink. */
  maxScaleClamp: 1,
  maxApparentScaleDist: 1520,
  appearFadeMs: 700,
  farFadeEndDist: 6400,
  farAlphaStartDist: 2200,
  farAlphaSoftDist: 4800,
  farAlphaFloor: 0.55,
  idleYAmpMin: 4,
  idleYAmpMax: 14,
  idleXAmpMin: 2,
  idleXAmpMax: 8,
  idleRotAmpDeg: 0.55,
  idleSpeedMin: 0.12,
  idleSpeedMax: 0.26,
};

export interface ScenePlacement {
  sceneX: number;
  sceneY: number;
  sceneZ: number;
  scaleMul: number;
}

export type ListWorldMode = 'independent' | 'sharedWall';

/** Phase 7.1: monitor ごとの LIST 世界。単位は world unit（px ではない）。 */
export interface ListWorld {
  mode: ListWorldMode;
  seed: number;
  /** wrap 周期 */
  width: number;
  height: number;
  multiplierX: number;
  multiplierY: number;
  /** 基準距離での可視範囲 */
  viewportWidth: number;
  viewportHeight: number;
  /** カード出現帯 */
  spawnSpanX: number;
  spawnSpanY: number;
  referenceDistance: number;
}

/** perspective camera が distance 先で見せる高さ。 */
export function visibleWorldHeightAt(distance: number, fovDeg = CAMERA_CONFIG.fov): number {
  return 2 * distance * Math.tan((fovDeg * Math.PI) / 360);
}

/** monitor ごとに抽出順・配置を変える seed。1 起動中は monitorId だけで決まる。 */
export function monitorWorldSeed(monitorId: number, baseSeed: number, stride: number): number {
  return baseSeed + monitorId * stride;
}

export function resolveListWorld(params: {
  mode: ListWorldMode;
  monitorId: number;
  aspect: number;
  baseSeed: number;
  seedStride: number;
  multiplierX: number;
  multiplierY: number;
  referenceDistance: number;
  spawnSpanMultiplier: number;
}): ListWorld {
  const referenceDistance = params.referenceDistance > 0 ? params.referenceDistance : 2200;
  const viewportHeight = visibleWorldHeightAt(referenceDistance);
  const viewportWidth = viewportHeight * Math.max(params.aspect, 0.01);

  if (params.mode === 'sharedWall') {
    const spanX = SCENE_LAYOUT.xRange[1] - SCENE_LAYOUT.xRange[0];
    const spanY = SCENE_LAYOUT.yRange[1] - SCENE_LAYOUT.yRange[0];
    return {
      mode: 'sharedWall',
      seed: SCENE_LAYOUT.seed,
      width: spanX,
      height: spanY,
      multiplierX: 1,
      multiplierY: 1,
      viewportWidth,
      viewportHeight,
      spawnSpanX: spanX,
      spawnSpanY: spanY,
      referenceDistance,
    };
  }

  const multiplierX = Math.max(2, params.multiplierX);
  const multiplierY = Math.max(2, params.multiplierY);
  const spawnSpanMultiplier = clamp(params.spawnSpanMultiplier, 0.5, multiplierX);
  return {
    mode: 'independent',
    seed: monitorWorldSeed(params.monitorId, params.baseSeed, params.seedStride),
    width: viewportWidth * multiplierX,
    height: viewportHeight * multiplierY,
    multiplierX,
    multiplierY,
    viewportWidth,
    viewportHeight,
    spawnSpanX: viewportWidth * spawnSpanMultiplier,
    spawnSpanY: viewportHeight * spawnSpanMultiplier,
    referenceDistance,
  };
}

/** 中心 0 の循環空間へ畳む。 */
export function wrapCentered(value: number, span: number): number {
  if (!(span > 0)) return value;
  const half = span / 2;
  let v = (value + half) % span;
  if (v < 0) v += span;
  return v - half;
}

/** from から to への torus 最短差分。端のつなぎ目を跨ぐ描画に使う。 */
export function wrapDelta(from: number, to: number, span: number): number {
  return wrapCentered(to - from, span);
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** `spans` を渡すと中心 0 のその範囲へ配置する（independent world）。省略時は SCENE_LAYOUT の範囲。 */
export function buildScenePlacements(
  count: number,
  seed = SCENE_LAYOUT.seed,
  spans?: { spanX: number; spanY: number },
): ScenePlacement[] {
  const rand = seededRandom(seed);
  const xMin = spans ? -spans.spanX / 2 : SCENE_LAYOUT.xRange[0];
  const xMax = spans ? spans.spanX / 2 : SCENE_LAYOUT.xRange[1];
  const yMin = spans ? -spans.spanY / 2 : SCENE_LAYOUT.yRange[0];
  const yMax = spans ? spans.spanY / 2 : SCENE_LAYOUT.yRange[1];
  const [zMin, zMax] = SCENE_LAYOUT.zRange;
  const spanX = xMax - xMin;
  const spanY = yMax - yMin;
  const cols = Math.max(1, Math.round(Math.sqrt(count * (spanX / Math.max(spanY, 1)))));
  const rows = Math.max(1, Math.ceil(count / cols));
  const cellW = spanX / cols;
  const cellH = spanY / rows;
  const placements: ScenePlacement[] = [];

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols) % rows;
    const x = xMin + (col + 0.2 + rand() * 0.6) * cellW;
    const y = yMin + (row + 0.2 + rand() * 0.6) * cellH;
    const band = Math.floor(rand() * 3);
    const t = rand();
    const spanZ = zMax - zMin;
    const sceneZ =
      band === 0
        ? zMin + t * spanZ * 0.34
        : band === 1
          ? zMin + spanZ * 0.34 + t * spanZ * 0.33
          : zMin + spanZ * 0.67 + t * spanZ * 0.33;
    placements.push({
      sceneX: clamp(x, xMin, xMax),
      sceneY: clamp(y, yMin, yMax),
      sceneZ,
      scaleMul: lerp(CARD_SCALE_RANGE.min, CARD_SCALE_RANGE.max, rand()),
    });
  }

  return placements;
}
