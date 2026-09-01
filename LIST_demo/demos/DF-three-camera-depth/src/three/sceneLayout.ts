/** DF 3D 空間レイアウト（seed 固定） */

export const SCENE_LAYOUT = {
  imageCount: 70,
  /** カメラパン範囲に近いフィールド（中央クラスタなし） */
  xRange: [-2000, 2000] as const,
  yRange: [-1200, 1200] as const,
  zRange: [-3000, 1200] as const,
  seed: 1234,
};

export const CAMERA_CONFIG = {
  /** やや広角 — ドリー時の遠近差が読みやすい */
  fov: 52,
  near: 10,
  far: 10000,
  initialX: 0,
  initialY: 0,
  initialZ: 1800,
  minZ: 200,
  maxZ: 4200,
  minX: -2200,
  maxX: 2200,
  minY: -1400,
  maxY: 1400,
  wheelSensitivity: 1.15,
  dragSensitivity: 1.35,
  smoothing: 0.12,
  minTimeline: 0,
  maxTimeline: 1,
  /** 奥の霞 — ドリーで遠近が判るよう強め */
  fogDensity: 0.00018,
};

/**
 * Shift+wheel: Cruise + 映画風ドリー
 * DE の timeScale ブーストではなく、カメラ速度＋慣性＋ソフト減速。
 * 符号: 負 = 潜る（Z↓）/ 正 = 引く（Z↑）
 */
export const DOLLY_CRUISE = {
  /** ホイール delta 100px 相当の速度インパルス [unit/s] */
  impulsePer100px: 520,
  /** クルーズ速度上限 [unit/s] */
  maxSpeed: 1600,
  /** Shift 保持・入力なし時の惰性摩擦（大きいほど早く減速） */
  coastFriction: 1.15,
  /** Shift 離したあとのブレーキ */
  releaseBrake: 3.8,
  /** 通常ホイール時にクルーズを殺す強さ */
  scrubCancelBrake: 8,
  /**
   * 無限ループ: cameraZ が [minZ,maxZ] を超えたら世界ごと shift
   * （相対位置は不変 → 境界で止まらず循環）
   */
  infiniteLoop: true,
  softBoundMargin: 420,
  poseSmoothingCruise: 0.2,
  fovWidenAtFullSpeed: 3.2,
  fovSmoothing: 0.07,
};

export const TAP_THRESHOLD = {
  maxMovePx: 12,
  maxDurationMs: 500,
};

export const HIT_TEST_MIN_ALPHA = 0.18;

/** DE 相当 — 微量浮遊 + 奥→手前ドリフト */
export const CARD_MOTION = {
  /** 奥→手前 [unit/s] — DE sceneDriftSpeed 58 に近い体感 */
  sceneDriftSpeed: 72,
  sceneDriftVariance: 0.18,
  /** カメラ手前でフェード開始 / 完了（cameraZ - sceneZ） */
  nearFadeStartDist: 280,
  nearFadeEndDist: 80,
  /** 極端に奥すぎたときだけ消す（中〜やや奥は残す） */
  farFadeStartDist: 2800,
  farFadeEndDist: 4200,
  /**
   * CULTISH 寄り — はっきり見える帯を広く、奥のごく遠いものだけ薄く
   * dist = cameraZ - sceneZ
   */
  depthCueRefDist: 900,
  /** この距離までは完全不透明 */
  farAlphaStartDist: 1750,
  /** この距離で farAlphaFloor に到達 */
  farAlphaSoftDist: 3200,
  nearAlphaBoost: 1,
  listAlpha: 1,
  /** 最奥でも「少し薄い」程度 */
  farAlphaFloor: 0.55,
  /** 奥ティントは弱め（洗った感を出さない） */
  farTintDarken: 0.88,
  nearScaleBoost: 1.04,
  farScaleMul: 0.94,
  idleYAmpMin: 4,
  idleYAmpMax: 14,
  idleXAmpMin: 2,
  idleXAmpMax: 8,
  idleRotAmpDeg: 0.55,
  idleSpeedMin: 0.12,
  idleSpeedMax: 0.26,
};

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

export interface ScenePlacement {
  sceneX: number;
  sceneY: number;
  sceneZ: number;
  scaleMul: number;
}

const PLACEMENT = {
  /** セル内ジッター（DE fieldJitter 相当） */
  fieldJitter: 0.82,
  boundsInset: 0.04,
  anyMinDist: 140,
  maxAttempts: 48,
};

function shrinkRange(
  min: number,
  max: number,
  inset: number,
): { min: number; max: number } {
  if (inset <= 0) return { min, max };
  const span = max - min;
  return { min: min + span * inset, max: max - span * inset };
}

/** far / mid / near 帯に Z を分散（DE pickStratifiedSceneZ 相当） */
function pickStratifiedSceneZ(rand: () => number, zMin: number, zMax: number): number {
  const span = zMax - zMin;
  const band = Math.floor(rand() * 3);
  const t = rand();
  if (band === 0) return zMin + t * span * 0.34;
  if (band === 1) return zMin + span * 0.34 + t * span * 0.33;
  return zMin + span * 0.67 + t * span * 0.33;
}

/**
 * DE 相当のフィールド配置 — 全域をセル分割＋ジッターで散らす（中央クラスタなし）
 */
export function buildScenePlacements(count: number, seed = SCENE_LAYOUT.seed): ScenePlacement[] {
  const rand = seededRandom(seed);
  const [xMinRaw, xMaxRaw] = SCENE_LAYOUT.xRange;
  const [yMinRaw, yMaxRaw] = SCENE_LAYOUT.yRange;
  const [zMin, zMax] = SCENE_LAYOUT.zRange;
  const xInner = shrinkRange(xMinRaw, xMaxRaw, PLACEMENT.boundsInset);
  const yInner = shrinkRange(yMinRaw, yMaxRaw, PLACEMENT.boundsInset);
  const spanX = xInner.max - xInner.min;
  const spanY = yInner.max - yInner.min;

  const aspect = spanX / Math.max(spanY, 1);
  const cols = Math.max(1, Math.round(Math.sqrt(count * aspect)));
  const rows = Math.max(1, Math.ceil(count / cols));
  const cellW = spanX / cols;
  const cellH = spanY / rows;
  const jitter = PLACEMENT.fieldJitter;

  const placements: ScenePlacement[] = [];
  const placed: { x: number; y: number }[] = [];

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols) % rows;
    let x = xInner.min + (col + 0.5) * cellW;
    let y = yInner.min + (row + 0.5) * cellH;

    for (let attempt = 0; attempt < PLACEMENT.maxAttempts; attempt++) {
      const padX = cellW * (1 - jitter) * 0.5;
      const padY = cellH * (1 - jitter) * 0.5;
      const usableW = Math.max(cellW - padX * 2, 1);
      const usableH = Math.max(cellH - padY * 2, 1);
      const nudge = attempt * 6;
      const candX = clamp(
        xInner.min + col * cellW + padX + rand() * usableW + (rand() - 0.5) * nudge,
        xInner.min,
        xInner.max,
      );
      const candY = clamp(
        yInner.min + row * cellH + padY + rand() * usableH + (rand() - 0.5) * nudge,
        yInner.min,
        yInner.max,
      );

      const farEnough = placed.every(
        (p) => Math.hypot(candX - p.x, candY - p.y) >= PLACEMENT.anyMinDist,
      );
      if (farEnough || attempt === PLACEMENT.maxAttempts - 1) {
        x = candX;
        y = candY;
        break;
      }
    }

    placed.push({ x, y });
    placements.push({
      sceneX: x,
      sceneY: y,
      sceneZ: pickStratifiedSceneZ(rand, zMin, zMax),
      scaleMul: lerp(0.72, 1.28, rand()),
    });
  }

  return placements;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function mapTimelineToCameraZ(timeline: number): number {
  const t = Math.max(0, Math.min(1, timeline));
  return lerp(CAMERA_CONFIG.maxZ, CAMERA_CONFIG.minZ, t);
}

export function mapCameraZToTimeline(cameraZ: number): number {
  const { minZ, maxZ } = CAMERA_CONFIG;
  return Math.max(0, Math.min(1, (maxZ - cameraZ) / (maxZ - minZ)));
}
