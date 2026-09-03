import { listConfig } from './listConfig';

export type VisualPresetId = 'soft-tint' | 'clean';
export type BubbleMotionId = 'elegant' | 'off';
export type PixelRatioCap = 1 | 1.5 | 2;
export type DollyFeelId = 'conservative' | 'default' | 'deep' | 'punchy';

export interface VisualPreset {
  id: VisualPresetId;
  label: string;
  tintHex: number;
  fogDensity: number;
}

export const VISUAL_PRESETS: Record<VisualPresetId, VisualPreset> = {
  'soft-tint': {
    id: 'soft-tint',
    label: 'soft-tint',
    tintHex: 0xe8e2d8,
    fogDensity: 0.00012,
  },
  clean: {
    id: 'clean',
    label: 'clean',
    tintHex: 0xffffff,
    fogDensity: 0.0001,
  },
};

export const DOLLY_FEEL_PRESETS: Record<
  DollyFeelId,
  {
    id: DollyFeelId;
    label: string;
    cameraDollySpeed: number;
    dollyPoseSmoothing: number;
    pinchDollyScale: number;
  }
> = {
  conservative: {
    id: 'conservative',
    label: 'conservative',
    cameraDollySpeed: 0.5,
    dollyPoseSmoothing: 0.12,
    pinchDollyScale: 0.6,
  },
  default: {
    id: 'default',
    label: 'default',
    cameraDollySpeed: 1,
    dollyPoseSmoothing: 0.2,
    pinchDollyScale: 1,
  },
  deep: {
    id: 'deep',
    label: 'deep',
    cameraDollySpeed: 1.8,
    dollyPoseSmoothing: 0.32,
    pinchDollyScale: 1.6,
  },
  punchy: {
    id: 'punchy',
    label: 'punchy',
    cameraDollySpeed: 2.6,
    dollyPoseSmoothing: 0.45,
    pinchDollyScale: 2.4,
  },
};

export const MAX_TEXTURE_EDGE = 1024;

export interface RuntimeConfig {
  visualPresetId: VisualPresetId;
  bubbleMotionId: BubbleMotionId;
  rendererPixelRatioMax: PixelRatioCap;
  bubbleSizePx: number;
  revealRadiusPx: number;
  listMotionSpeed: number;
  cameraDollySpeed: number;
  dollyCruiseEnabled: boolean;
  dollyPoseSmoothing: number;
  pinchDollyScale: number;
}

const punchy = DOLLY_FEEL_PRESETS.punchy;

export const runtimeConfig: RuntimeConfig = {
  visualPresetId: 'clean',
  bubbleMotionId: 'off',
  rendererPixelRatioMax: listConfig.rendererPixelRatioMax as PixelRatioCap,
  bubbleSizePx: listConfig.bubbleSizePx,
  revealRadiusPx: listConfig.revealRadiusPx,
  listMotionSpeed: listConfig.listMotionSpeed,
  cameraDollySpeed: punchy.cameraDollySpeed,
  dollyCruiseEnabled: listConfig.dollyCruiseEnabled,
  dollyPoseSmoothing: punchy.dollyPoseSmoothing,
  pinchDollyScale: punchy.pinchDollyScale,
};

const listeners = new Set<() => void>();

export function patchRuntimeConfig(patch: Partial<RuntimeConfig>): void {
  Object.assign(runtimeConfig, patch);
  for (const listener of listeners) listener();
}

export function onRuntimeConfigChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getVisualPreset(): VisualPreset {
  return VISUAL_PRESETS[runtimeConfig.visualPresetId] ?? VISUAL_PRESETS['soft-tint'];
}

export function matchDollyFeel(
  speed: number,
  smoothing: number,
  pinch: number,
): DollyFeelId | 'custom' {
  for (const id of Object.keys(DOLLY_FEEL_PRESETS) as DollyFeelId[]) {
    const p = DOLLY_FEEL_PRESETS[id];
    if (p.cameraDollySpeed === speed && p.dollyPoseSmoothing === smoothing && p.pinchDollyScale === pinch) {
      return id;
    }
  }
  return 'custom';
}
