import {
  applyTonePresetToImage,
  DEFAULT_TONE_PRESET,
  type TonePresetId,
} from './tonePresets';

export type VisualPresetId = 'clean' | 'cultish-soft' | 'cultish-heavy';

export type ImageToneMode = 'soft' | 'dramatic';

export interface VisualConfig {
  presetId: VisualPresetId;
  background: {
    color: string;
    gradientTop: string;
    gradientBottom: string;
    gradientOpacity: number;
    noiseEnabled: boolean;
    noiseOpacity: number;
    /** public/ 配下のタイル PNG（未配置時は procedural）例: /textures/noise-turbulence.png */
    noiseTextureUrl?: string;
    noiseTileSize: number;
    noiseBlendMode: 'overlay' | 'soft-light' | 'screen';
  };
  world: {
    width: number;
    height: number;
    margin: number;
    defaultZoom: number;
    panPaddingScreen: number;
    contentPadding: number;
  };
  placement: {
    sameGroupMinDist: number;
    anyMinDist: number;
    /** フィールド配置時のセル内ジッター（0〜1） */
    fieldJitter: number;
    /** 配置可能領域をワールド端から内側に寄せる（0〜0.3） */
    boundsInset: number;
  };
  image: {
    /** LIST 探索層: true ならモノトーン（IMAGE_ZOOM は DOM でカラー） */
    grayscale: boolean;
    toneMode: ImageToneMode;
    /** Pixi v8 contrast: 0.5=標準、下げるとシャドウ持ち上げ＋白飛び抑制 */
    contrast: number;
    /** 明るさ — 黒フロア持ち上げ（ガンマ補正相当） */
    brightness: number;
    listAlpha: number;
    /** @deprecated toneMode 参照 */
    greyscaleAmount: number;
  };
  depth: {
    enabled: boolean;
    layers: number;
    parallaxStrength: number;
    parallaxFar: number;
    parallaxMid: number;
    parallaxNear: number;
    scaleRange: [number, number];
    alphaRange: [number, number];
  };
  float: {
    enabled: boolean;
    amplitudeY: number;
    amplitudeRot: number;
    speed: number;
  };
  touchReaction: {
    enabled: boolean;
    strength: number;
    radius: number;
    lag: number;
  };
  tapFocus: {
    enabled: boolean;
    scale: number;
    brightnessBoost: number;
    durationMs: number;
  };
}

/** 深い黒背景（review 用） */
const BG_BASE = '#050505';
const BG_TOP = '#070707';
const BG_BOTTOM = '#030303';

const WORLD_BASE = {
  width: 3000,
  height: 2200,
  margin: 88,
  defaultZoom: 0.86,
  panPaddingScreen: 36,
  contentPadding: 56,
};

const PLACEMENT_BASE = {
  sameGroupMinDist: 168,
  anyMinDist: 62,
  /** セル内ランダム幅（0.6〜0.9 推奨） */
  fieldJitter: 0.82,
  boundsInset: 0.05,
};

/** LIST 画像トーンのプレースホルダ — getVisualConfig で tonePreset を上書き */
const IMAGE_TONE_PLACEHOLDER = {
  contrast: 0.5,
  brightness: 1,
} as const;

export const VISUAL_PRESETS: Record<VisualPresetId, VisualConfig> = {
  clean: {
    presetId: 'clean',
    background: {
      color: BG_BASE,
      gradientTop: BG_TOP,
      gradientBottom: BG_BOTTOM,
      gradientOpacity: 0.28,
      noiseEnabled: false,
      noiseOpacity: 0,
      noiseTextureUrl: '/textures/noise-turbulence.png',
      noiseTileSize: 200,
      noiseBlendMode: 'soft-light',
    },
    world: { ...WORLD_BASE, defaultZoom: 1.0 },
    placement: PLACEMENT_BASE,
    image: {
      grayscale: true,
      toneMode: 'soft',
      ...IMAGE_TONE_PLACEHOLDER,
      listAlpha: 1,
      greyscaleAmount: 1,
    },
    depth: {
      enabled: false,
      layers: 3,
      parallaxStrength: 0,
      parallaxFar: 0.75,
      parallaxMid: 0.9,
      parallaxNear: 1.05,
      scaleRange: [1, 1],
      alphaRange: [1, 1],
    },
    float: { enabled: false, amplitudeY: 0, amplitudeRot: 0, speed: 0 },
    touchReaction: { enabled: false, strength: 0, radius: 120, lag: 0 },
    tapFocus: { enabled: true, scale: 1.05, brightnessBoost: 0.06, durationMs: 150 },
  },
  'cultish-soft': {
    presetId: 'cultish-soft',
    background: {
      color: BG_BASE,
      gradientTop: BG_TOP,
      gradientBottom: BG_BOTTOM,
      gradientOpacity: 0.12,
      noiseEnabled: true,
      noiseOpacity: 0.14,
      noiseTextureUrl: '/textures/noise-turbulence.png',
      noiseTileSize: 200,
      noiseBlendMode: 'soft-light',
    },
    world: WORLD_BASE,
    placement: PLACEMENT_BASE,
    image: {
      grayscale: true,
      toneMode: 'soft',
      ...IMAGE_TONE_PLACEHOLDER,
      listAlpha: 1,
      greyscaleAmount: 1,
    },
    depth: {
      enabled: true,
      layers: 3,
      parallaxStrength: 0.16,
      parallaxFar: 0.74,
      parallaxMid: 0.9,
      parallaxNear: 1.05,
      scaleRange: [0.9, 1.04],
      alphaRange: [0.84, 1],
    },
    float: {
      enabled: false,
      amplitudeY: 4.5,
      amplitudeRot: 0.005,
      speed: 0.2,
    },
    touchReaction: {
      enabled: true,
      strength: 0.085,
      radius: 150,
      lag: 0.1,
    },
    tapFocus: {
      enabled: true,
      scale: 1.06,
      brightnessBoost: 0.09,
      durationMs: 180,
    },
  },
  'cultish-heavy': {
    presetId: 'cultish-heavy',
    background: {
      color: BG_BASE,
      gradientTop: BG_TOP,
      gradientBottom: BG_BOTTOM,
      gradientOpacity: 0.32,
      noiseEnabled: true,
      noiseOpacity: 0.22,
      noiseTextureUrl: '/textures/noise-turbulence.png',
      noiseTileSize: 200,
      noiseBlendMode: 'soft-light',
    },
    world: { ...WORLD_BASE, defaultZoom: 1.0 },
    placement: {
      ...PLACEMENT_BASE,
      sameGroupMinDist: 200,
      fieldJitter: 0.78,
      boundsInset: 0.04,
    },
    image: {
      grayscale: true,
      toneMode: 'dramatic',
      ...IMAGE_TONE_PLACEHOLDER,
      listAlpha: 1,
      greyscaleAmount: 1,
    },
    depth: {
      enabled: true,
      layers: 3,
      parallaxStrength: 0.2,
      parallaxFar: 0.7,
      parallaxMid: 0.88,
      parallaxNear: 1.08,
      scaleRange: [0.86, 1.06],
      alphaRange: [0.8, 1],
    },
    float: {
      enabled: true,
      amplitudeY: 6,
      amplitudeRot: 0.006,
      speed: 0.24,
    },
    touchReaction: {
      enabled: true,
      strength: 0.11,
      radius: 165,
      lag: 0.14,
    },
    tapFocus: {
      enabled: true,
      scale: 1.08,
      brightnessBoost: 0.11,
      durationMs: 200,
    },
  },
};

export const DEFAULT_PRESET: VisualPresetId = 'cultish-soft';

export type { TonePresetId } from './tonePresets';
export { DEFAULT_TONE_PRESET, TONE_PRESETS, TONE_PRESET_IDS } from './tonePresets';

export function getVisualConfig(
  presetId: VisualPresetId,
  tonePresetId: TonePresetId = DEFAULT_TONE_PRESET,
): VisualConfig {
  const config = JSON.parse(JSON.stringify(VISUAL_PRESETS[presetId])) as VisualConfig;
  config.image = applyTonePresetToImage(config.image, tonePresetId);
  return config;
}
