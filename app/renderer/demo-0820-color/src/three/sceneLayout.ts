export const SCENE_LAYOUT = {
  xRange: [-2200, 2200] as const,
  yRange: [-1400, 1400] as const,
  zRange: [-4800, 2000] as const,
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
  minX: -2400,
  maxX: 2400,
  minY: -1600,
  maxY: 1600,
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
  nearFadeStartDist: 280,
  nearFadeEndDist: 80,
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

export function buildScenePlacements(count: number, seed = SCENE_LAYOUT.seed): ScenePlacement[] {
  const rand = seededRandom(seed);
  const [xMin, xMax] = SCENE_LAYOUT.xRange;
  const [yMin, yMax] = SCENE_LAYOUT.yRange;
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
