import type { VisualConfig } from '../visualConfig';

export type DepthLayerId = 'far' | 'mid' | 'near';

export function depthToLayer(depth: number): DepthLayerId {
  if (depth < 0.34) return 'far';
  if (depth < 0.67) return 'mid';
  return 'near';
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
