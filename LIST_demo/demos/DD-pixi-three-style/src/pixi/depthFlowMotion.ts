import { BlurFilter } from 'pixi.js';
import type { MotionConfig } from '../motionConfig';
import type { ExploreScene, PlacedImage } from './exploreScene';
import { depthLabelForFlow, type DepthFlowStageId } from './depthController';
import { computeSignedFlowSpeed } from './depthFlowSpeed';
import { isCameraNavigationMode } from './cameraDepth';
import { pickStratifiedSceneZ } from './cameraDepthMotion';
import type { ContentBounds } from './worldBounds';
import { getWorldPanBounds, mergeBounds } from './worldBounds';
import type { VisualConfig } from '../visualConfig';

export interface DepthFlowState {
  flowDepth: number;
  /** E-2: imageDepth - cameraDepth */
  relativeDepth?: number;
  depthLabel: DepthFlowStageId;
  scaleMul: number;
  alphaMul: number;
  brightnessMul: number;
  contrastMul: number;
  blurStrength: number;
  offsetX: number;
  offsetY: number;
  renderOrder: number;
  respawned: boolean;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 0↔1 境界で滑らかに補間 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function computeRenderOrder(flowDepth: number, stableIndex: number): number {
  return Math.round(flowDepth * 10_000) + stableIndex;
}

type DepthStageTuple = readonly [number, number, number, number];

/** 4 knot 間を smoothstep で連続補間（flowDepth 0→1） */
export function sampleDepthStageCurve(stages: DepthStageTuple, depth: number): number {
  const d = Math.max(0, Math.min(1, depth));
  const segmentCount = stages.length - 1;
  const t = d * segmentCount;
  const i = Math.min(segmentCount - 1, Math.floor(t));
  const localT = smoothstep(0, 1, t - i);
  return lerp(stages[i], stages[i + 1], localT);
}

export function getDepthFlowSpawnBounds(
  scene: ExploreScene,
  config: VisualConfig,
  motion: MotionConfig,
): ContentBounds {
  const { spawnPaddingX, spawnPaddingY } = motion.depthFlow;
  const merged = mergeBounds(scene.contentBounds, getWorldPanBounds(config.world));
  return {
    minX: merged.minX - spawnPaddingX,
    minY: merged.minY - spawnPaddingY,
    maxX: merged.maxX + spawnPaddingX,
    maxY: merged.maxY + spawnPaddingY,
  };
}

function randomInBounds(bounds: ContentBounds): { x: number; y: number } {
  return {
    x: bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
    y: bounds.minY + Math.random() * (bounds.maxY - bounds.minY),
  };
}

/** 配置時 — flowDepth / imageDepth / 方向 / 速度を付与 */
export function initDepthFlowParams(
  item: Pick<
    PlacedImage,
    | 'flowDepth'
    | 'sceneZ'
    | 'sceneZDriftMul'
    | 'flowSpeed'
    | 'flowSpeedVariance'
    | 'flowDirX'
    | 'flowDirY'
    | 'flowMotionDistance'
  >,
  rand: () => number,
  motion: MotionConfig,
): void {
  const { depthFlow } = motion;
  if (!depthFlow.enabled) {
    item.flowDepth = 0;
    item.sceneZ = 0;
    item.sceneZDriftMul = 1;
    item.flowSpeed = 0;
    item.flowSpeedVariance = 0;
    item.flowDirX = 0;
    item.flowDirY = -1;
    item.flowMotionDistance = 0;
    return;
  }

  const angle = rand() * Math.PI * 2;
  item.flowDirX = Math.cos(angle);
  item.flowDirY = Math.sin(angle);

  if (depthFlow.depthMode === 'camera-navigation') {
    item.sceneZ = pickStratifiedSceneZ(rand, motion);
    const variance = motion.cameraDepth.sceneDriftVariance;
    item.sceneZDriftMul = 1 + (rand() * 2 - 1) * variance;
    item.flowDepth = 0;
    item.flowSpeed = 0;
    item.flowSpeedVariance = 0;
    item.flowMotionDistance = 0;
    return;
  }

  item.flowDepth = rand();
  item.flowSpeedVariance = (rand() * 2 - 1) * depthFlow.speedVariance;
  item.flowSpeed = computeSignedFlowSpeed(item.flowSpeedVariance);

  item.flowMotionDistance = lerp(
    depthFlow.motionDistanceMin,
    depthFlow.motionDistanceMax,
    rand(),
  );
}

function respawnParticleAtDepth(
  item: PlacedImage,
  scene: ExploreScene,
  config: VisualConfig,
  motion: MotionConfig,
  flowDepth: number,
): void {
  const bounds = getDepthFlowSpawnBounds(scene, config, motion);
  const pos = randomInBounds(bounds);

  item.flowDepth = flowDepth;
  item.baseX = pos.x;
  item.baseY = pos.y;
  item.flowSpeedVariance = (Math.random() * 2 - 1) * motion.depthFlow.speedVariance;
  item.flowSpeed = computeSignedFlowSpeed(item.flowSpeedVariance);

  const angle = Math.random() * Math.PI * 2;
  item.flowDirX = Math.cos(angle);
  item.flowDirY = Math.sin(angle);
  item.flowMotionDistance = lerp(
    motion.depthFlow.motionDistanceMin,
    motion.depthFlow.motionDistanceMax,
    Math.random(),
  );

  item.reactionOffsetX = 0;
  item.reactionOffsetY = 0;
  item.reactionScale = 1;
  scene.depthFlowRespawnCount += 1;
}

/** 手前抜け → 最奥から再出現 */
function respawnParticle(item: PlacedImage, scene: ExploreScene, config: VisualConfig, motion: MotionConfig): void {
  respawnParticleAtDepth(item, scene, config, motion, 0);
}

/** 逆再生で最奥到達 → 手前側から再出現 */
function respawnParticleAtFront(
  item: PlacedImage,
  scene: ExploreScene,
  config: VisualConfig,
  motion: MotionConfig,
): void {
  respawnParticleAtDepth(item, scene, config, motion, 1);
}

function clampFlowDepth(flowDepth: number): number {
  return Math.max(0, Math.min(1, flowDepth));
}

function computeVisuals(flowDepth: number, motion: MotionConfig, item: PlacedImage): Omit<DepthFlowState, 'flowDepth' | 'depthLabel' | 'respawned'> {
  const { depthFlow } = motion;
  const depth = clampFlowDepth(flowDepth);
  const d = smoothstep(0, 1, depth);

  const depthAlpha = sampleDepthStageCurve(depthFlow.alphaByStage, depth);
  const fadeIn = smoothstep(depthFlow.fadeInStart, depthFlow.fadeInEnd, depth);
  const fadeOut = 1 - smoothstep(depthFlow.fadeOutStart, depthFlow.fadeOutEnd, depth);

  const motionT = d;
  const offsetX = item.flowDirX * item.flowMotionDistance * motionT;
  const offsetY = item.flowDirY * item.flowMotionDistance * motionT;

  return {
    scaleMul: sampleDepthStageCurve(depthFlow.scaleByStage, depth),
    alphaMul: depthAlpha * fadeIn * fadeOut,
    brightnessMul: sampleDepthStageCurve(depthFlow.brightnessByStage, depth),
    contrastMul: sampleDepthStageCurve(depthFlow.contrastByStage, depth),
    blurStrength: sampleDepthStageCurve(depthFlow.blurByStage, depth),
    offsetX,
    offsetY,
    renderOrder: computeRenderOrder(depth, item.stableIndex),
  };
}

/**
 * E — ループ型 depth flow
 * 正方向: flowDepth 0→1 → 最奥 respawn
 * 逆方向: flowDepth 1→0 → 手前 respawn
 */
export function integrateDepthFlow(
  item: PlacedImage,
  scene: ExploreScene,
  deltaTime: number,
  config: VisualConfig,
  motion: MotionConfig,
): DepthFlowState {
  const { depthFlow } = motion;
  if (!depthFlow.enabled) {
    const d = item.depth;
    const visuals = {
      scaleMul: 1,
      alphaMul: 1,
      brightnessMul: 1,
      contrastMul: 1,
      blurStrength: 0,
      offsetX: 0,
      offsetY: 0,
      renderOrder: computeRenderOrder(d, item.stableIndex),
    };
    return {
      flowDepth: d,
      depthLabel: depthLabelForFlow(d),
      respawned: false,
      ...visuals,
    };
  }

  if (depthFlow.depthMode === 'camera-navigation') {
    const d = item.depth;
    return {
      flowDepth: d,
      depthLabel: depthLabelForFlow(d),
      respawned: false,
      scaleMul: 1,
      alphaMul: 1,
      brightnessMul: 1,
      contrastMul: 1,
      blurStrength: 0,
      offsetX: 0,
      offsetY: 0,
      renderOrder: computeRenderOrder(d, item.stableIndex),
    };
  }

  let respawned = false;
  item.flowSpeed = computeSignedFlowSpeed(item.flowSpeedVariance);
  item.flowDepth += deltaTime * item.flowSpeed;

  if (item.flowDepth >= 1) {
    respawnParticle(item, scene, config, motion);
    respawned = true;
  } else if (item.flowDepth <= 0) {
    respawnParticleAtFront(item, scene, config, motion);
    respawned = true;
  }

  const depthForLabel = clampFlowDepth(item.flowDepth);
  const visuals = computeVisuals(item.flowDepth, motion, item);

  return {
    flowDepth: item.flowDepth,
    depthLabel: depthLabelForFlow(depthForLabel),
    respawned,
    ...visuals,
  };
}

export function createDepthBlurFilter(): BlurFilter {
  return new BlurFilter({ strength: 0, quality: 2 });
}

export function applyDepthBlur(blurFilter: BlurFilter, strength: number): void {
  blurFilter.strength = strength;
}
