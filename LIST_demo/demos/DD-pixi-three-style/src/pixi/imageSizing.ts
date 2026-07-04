/** LIST 表示サイズ帯（長辺 px） */
export const IMAGE_SIZE_PRESETS = {
  small: { min: 120, max: 180, weight: 0.45 },
  medium: { min: 180, max: 280, weight: 0.4 },
  large: { min: 280, max: 420, weight: 0.15 },
} as const;

export type SizePreset = keyof typeof IMAGE_SIZE_PRESETS;

/** 最大長辺の上限（large preset max と一致） */
export const MAX_TARGET_LONG_SIDE = 420;

/** 配置ランダムのシード */
export const PLACEMENT_SEED = 42;

export interface ImageDisplayMetrics {
  originalWidth: number;
  originalHeight: number;
  displayedWidth: number;
  displayedHeight: number;
  displayedLongSide: number;
  scale: number;
  targetLongSide: number;
  preset: SizePreset;
}

export interface DisplaySizeStats {
  minLongSide: number;
  maxLongSide: number;
  avgLongSide: number;
  maxTargetLongSide: number;
  presetCounts: Record<SizePreset, number>;
}

export function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function pickSizePreset(rand: () => number): SizePreset {
  const r = rand();
  if (r < IMAGE_SIZE_PRESETS.small.weight) return 'small';
  if (r < IMAGE_SIZE_PRESETS.small.weight + IMAGE_SIZE_PRESETS.medium.weight) return 'medium';
  return 'large';
}

export function pickTargetLongSide(preset: SizePreset, rand: () => number): number {
  const { min, max } = IMAGE_SIZE_PRESETS[preset];
  const target = min + rand() * (max - min);
  return Math.min(target, MAX_TARGET_LONG_SIDE);
}

/** 長辺を targetLongSide に合わせる均一 scale（縦横比維持） */
export function computeUniformScale(
  textureWidth: number,
  textureHeight: number,
  targetLongSide: number,
): number {
  const longSide = Math.max(textureWidth, textureHeight);
  if (longSide <= 0) return 1;
  return targetLongSide / longSide;
}

export function buildDisplayMetrics(
  textureWidth: number,
  textureHeight: number,
  targetLongSide: number,
  preset: SizePreset,
): ImageDisplayMetrics {
  const scale = computeUniformScale(textureWidth, textureHeight, targetLongSide);
  const displayedWidth = textureWidth * scale;
  const displayedHeight = textureHeight * scale;
  return {
    originalWidth: textureWidth,
    originalHeight: textureHeight,
    displayedWidth,
    displayedHeight,
    displayedLongSide: Math.max(displayedWidth, displayedHeight),
    scale,
    targetLongSide,
    preset,
  };
}

export function aggregateDisplaySizeStats(metrics: ImageDisplayMetrics[]): DisplaySizeStats {
  const presetCounts: Record<SizePreset, number> = { small: 0, medium: 0, large: 0 };
  if (metrics.length === 0) {
    return {
      minLongSide: 0,
      maxLongSide: 0,
      avgLongSide: 0,
      maxTargetLongSide: MAX_TARGET_LONG_SIDE,
      presetCounts,
    };
  }

  let minLongSide = Infinity;
  let maxLongSide = 0;
  let sum = 0;

  for (const m of metrics) {
    minLongSide = Math.min(minLongSide, m.displayedLongSide);
    maxLongSide = Math.max(maxLongSide, m.displayedLongSide);
    sum += m.displayedLongSide;
    presetCounts[m.preset] += 1;
  }

  return {
    minLongSide,
    maxLongSide,
    avgLongSide: sum / metrics.length,
    maxTargetLongSide: MAX_TARGET_LONG_SIDE,
    presetCounts,
  };
}
