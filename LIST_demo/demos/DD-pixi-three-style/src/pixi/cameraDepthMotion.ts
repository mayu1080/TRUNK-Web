import { getSceneTimeDriftDirection, getSceneTimeScale } from './cameraDepth';
import type { MotionConfig } from '../motionConfig';
import type { ExploreScene, PlacedImage } from './exploreScene';
import { depthLabelForFlow } from './depthController';
import { getDepthFlowSpawnBounds, smoothstep } from './depthFlowMotion';
import type { VisualConfig } from '../visualConfig';

export interface CameraProjectionState {
  relativeZ: number;
  perspective: number;
  screenX: number;
  screenY: number;
  scaleMul: number;
  alphaMul: number;
  brightnessMul: number;
  contrastMul: number;
  blurStrength: number;
  renderOrder: number;
  depthLabel: ReturnType<typeof depthLabelForFlow>;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** far / mid / near 帯に分散した sceneZ（ワールド座標） */
export function pickStratifiedSceneZ(rand: () => number, motion: MotionConfig): number {
  const { minSceneZ, maxSceneZ } = motion.cameraDepth;
  const span = maxSceneZ - minSceneZ;
  const band = Math.floor(rand() * 3);
  const t = rand();
  if (band === 0) return minSceneZ + t * span * 0.34;
  if (band === 1) return minSceneZ + span * 0.34 + t * span * 0.33;
  return minSceneZ + span * 0.67 + t * span * 0.33;
}

function farClipFade(relativeZ: number, motion: MotionConfig): number {
  const { farFadeStart, farFadeEnd } = motion.cameraDepth;
  if (relativeZ <= farFadeStart) return 1;
  return 1 - smoothstep(farFadeStart, farFadeEnd, relativeZ);
}

/**
 * 奥〜中: alpha=1 / 手前のみフェードアウト
 * （奥の半透明は使わない — 弱ブラーで遠近を示す）
 */
function stagedDepthAlpha(relativeZ: number, motion: MotionConfig): number {
  const { clearZoneNear, nearFadeStart, nearFadeEnd } = motion.cameraDepth;

  if (relativeZ >= clearZoneNear) return 1;
  if (relativeZ >= nearFadeStart) return 1;
  return smoothstep(nearFadeEnd, nearFadeStart, relativeZ);
}

function computeRenderOrder(relativeZ: number, stableIndex: number): number {
  return Math.round((4000 - relativeZ) * 10) + stableIndex;
}

/** 画面中央を消失点とする look-at（ワールド座標） */
export function computeCameraLookAt(
  viewPanX: number,
  viewPanY: number,
  viewZoom: number,
  viewportWidth: number,
  viewportHeight: number,
): { cameraX: number; cameraY: number } {
  return {
    cameraX: (viewportWidth / 2 - viewPanX) / viewZoom,
    cameraY: (viewportHeight / 2 - viewPanY) / viewZoom,
  };
}

function respawnSceneImageAtFar(
  item: PlacedImage,
  scene: ExploreScene,
  config: VisualConfig,
  motion: MotionConfig,
  cameraZ: number,
): void {
  const bounds = getDepthFlowSpawnBounds(scene, config, motion);
  const { minSceneZ, maxSceneZ } = motion.cameraDepth;
  const span = maxSceneZ - minSceneZ;

  item.sceneZ = minSceneZ + Math.random() * span * 0.45;
  const pos = {
    x: bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
    y: bounds.minY + Math.random() * (bounds.maxY - bounds.minY),
  };
  item.sceneX = pos.x;
  item.sceneY = pos.y;
  item.baseX = pos.x;
  item.baseY = pos.y;
  item.reactionOffsetX = 0;
  item.reactionOffsetY = 0;
  item.reactionScale = 1;
  item.lastRelativeZ = item.sceneZ - cameraZ;
  scene.depthFlowRespawnCount += 1;
}

function respawnSceneImageAtNear(
  item: PlacedImage,
  scene: ExploreScene,
  config: VisualConfig,
  motion: MotionConfig,
  cameraZ: number,
): void {
  const bounds = getDepthFlowSpawnBounds(scene, config, motion);
  const { nearFadeStart } = motion.cameraDepth;

  item.sceneZ = cameraZ + nearFadeStart * 0.35 + Math.random() * 80;
  const pos = {
    x: bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
    y: bounds.minY + Math.random() * (bounds.maxY - bounds.minY),
  };
  item.sceneX = pos.x;
  item.sceneY = pos.y;
  item.baseX = pos.x;
  item.baseY = pos.y;
  item.reactionOffsetX = 0;
  item.reactionOffsetY = 0;
  item.reactionScale = 1;
  item.lastRelativeZ = item.sceneZ - cameraZ;
  scene.depthFlowRespawnCount += 1;
}

/**
 * sceneZ ドリフト — 通常は奥→手前、Shift+下で手前→奥（巻き戻し）
 */
export function integrateSceneZDrift(
  item: PlacedImage,
  cameraZ: number,
  deltaTime: number,
  scene: ExploreScene,
  config: VisualConfig,
  motion: MotionConfig,
): boolean {
  const { sceneDriftSpeed, nearFadeEnd, farFadeEnd } = motion.cameraDepth;
  const dir = getSceneTimeDriftDirection();
  const drift = sceneDriftSpeed * item.sceneZDriftMul * getSceneTimeScale();
  item.sceneZ -= drift * dir * deltaTime;

  const relativeZ = item.sceneZ - cameraZ;

  if (dir > 0 && relativeZ < nearFadeEnd) {
    respawnSceneImageAtFar(item, scene, config, motion, cameraZ);
    return true;
  }
  if (dir < 0 && relativeZ > farFadeEnd) {
    respawnSceneImageAtNear(item, scene, config, motion, cameraZ);
    return true;
  }
  return false;
}

/**
 * 疑似3D投影 — scene 座標固定 + cameraZ / perspective
 * screen = lookAt + (scene - lookAt) * perspective
 */
export function computeCameraProjection(
  item: PlacedImage,
  cameraX: number,
  cameraY: number,
  cameraZ: number,
  motion: MotionConfig,
): CameraProjectionState {
  const cfg = motion.cameraDepth;
  const relativeZ = item.sceneZ - cameraZ;

  const rawPerspective = cfg.focalLength / (cfg.focalLength + relativeZ);
  const cappedZ = Math.max(relativeZ, cfg.nearFadeEnd);
  const perspective = cfg.focalLength / (cfg.focalLength + cappedZ);

  const screenX = cameraX + (item.sceneX - cameraX) * perspective;
  const screenY = cameraY + (item.sceneY - cameraY) * perspective;

  const farClip = farClipFade(relativeZ, motion);
  const stageAlpha = stagedDepthAlpha(relativeZ, motion);
  const alphaMul = stageAlpha * farClip;

  const farT = clamp(
    (relativeZ - cfg.clearZoneFar) / Math.max(cfg.approachBandFar - cfg.clearZoneFar, 1),
    0,
    1,
  );
  const inClear = relativeZ <= cfg.clearZoneFar && relativeZ >= cfg.clearZoneNear;
  const fadingOut = relativeZ < cfg.clearZoneNear;
  const brightnessMul = fadingOut
    ? 0.9 + stageAlpha * 0.1
    : inClear
      ? 1.05
      : lerp(1.02, 0.88, farT);
  const contrastMul = inClear || fadingOut ? 1 : lerp(1, 0.94, farT);
  // 奥のみ弱ブラー。はっきり帯・フェードアウト中はブラーなし
  const blurStrength = relativeZ > cfg.clearZoneFar ? lerp(0.6, 2.2, farT) : 0;

  const depthNorm = clamp(1 - clamp(relativeZ / Math.max(cfg.clearZoneFar, 1), 0, 1), 0, 1);

  return {
    relativeZ,
    perspective: rawPerspective,
    screenX,
    screenY,
    scaleMul: perspective,
    alphaMul,
    brightnessMul,
    contrastMul,
    blurStrength,
    renderOrder: computeRenderOrder(relativeZ, item.stableIndex),
    depthLabel: depthLabelForFlow(depthNorm),
  };
}
