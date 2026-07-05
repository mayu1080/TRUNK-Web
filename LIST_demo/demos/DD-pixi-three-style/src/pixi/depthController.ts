import type { VisualConfig } from '../visualConfig';

export type DepthLayerId = 'far' | 'mid' | 'near';

/** Depth Flow E — 4段階デバッグラベル */
export type DepthFlowStageId = 'far' | 'midFar' | 'midNear' | 'near';

const DEPTH_FLOW_STAGE_LABELS: readonly DepthFlowStageId[] = [
  'far',
  'midFar',
  'midNear',
  'near',
];

export function depthToLayer(depth: number): DepthLayerId {
  if (depth < 0.34) return 'far';
  if (depth < 0.67) return 'mid';
  return 'near';
}

/** Depth Flow E — flowDepth から 4段階ラベル（親 container 切替には使わない） */
export function depthLabelForFlow(flowDepth: number): DepthFlowStageId {
  const d = Math.max(0, Math.min(1, flowDepth));
  const stage = Math.min(DEPTH_FLOW_STAGE_LABELS.length - 1, Math.floor(d * 4));
  return DEPTH_FLOW_STAGE_LABELS[stage];
}

export function parallaxCoeffForDepth(depth: number, config: VisualConfig): number {
  const { parallaxFar, parallaxMid, parallaxNear } = config.depth;
  if (depth < 0.34) return parallaxFar;
  if (depth < 0.67) return parallaxMid;
  return parallaxNear;
}

export function depthScale(depth: number, config: VisualConfig): number {
  const [minS, maxS] = config.depth.scaleRange;
  return minS + depth * (maxS - minS);
}

export function depthAlpha(depth: number, config: VisualConfig): number {
  const [minA, maxA] = config.depth.alphaRange;
  return minA + depth * (maxA - minA);
}

export function layerParallaxOffset(
  panX: number,
  panY: number,
  coeff: number,
  strength: number,
): { x: number; y: number } {
  const factor = (coeff - 1) * strength;
  return { x: panX * factor, y: panY * factor };
}
