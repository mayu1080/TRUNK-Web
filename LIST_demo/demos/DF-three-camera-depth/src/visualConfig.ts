/** DF visual presets — DOM noise / fog / mesh tint */

export type VisualPresetId = 'clean' | 'cultish-soft' | 'cultish-heavy' | 'soft-tint';

export interface DfVisualConfig {
  presetId: VisualPresetId;
  background: {
    color: string;
    gradientTop: string;
    gradientBottom: string;
    gradientOpacity: number;
    noiseEnabled: boolean;
    noiseOpacity: number;
    noiseTextureUrl?: string;
    noiseTileSize: number;
    noiseBlendMode: 'overlay' | 'soft-light' | 'screen';
  };
  /** MeshBasicMaterial 乗算ティント */
  tintHex: number;
  fogDensity: number;
  listAlpha: number;
  description: string;
}

const BG = '#0a0a0a';
const BG_TOP = '#121212';
const BG_BOTTOM = '#050505';

export const VISUAL_PRESETS: Record<VisualPresetId, DfVisualConfig> = {
  clean: {
    presetId: 'clean',
    background: {
      color: BG,
      gradientTop: BG_TOP,
      gradientBottom: BG_BOTTOM,
      gradientOpacity: 0.22,
      noiseEnabled: false,
      noiseOpacity: 0,
      noiseTextureUrl: '/textures/noise-turbulence.png',
      noiseTileSize: 200,
      noiseBlendMode: 'soft-light',
    },
    tintHex: 0xffffff,
    fogDensity: 0.0001,
    listAlpha: 1,
    description: 'ノイズ OFF・ニュートラル灰',
  },
  'cultish-soft': {
    presetId: 'cultish-soft',
    background: {
      color: BG,
      gradientTop: BG_TOP,
      gradientBottom: BG_BOTTOM,
      gradientOpacity: 0.12,
      noiseEnabled: true,
      noiseOpacity: 0.14,
      noiseTextureUrl: '/textures/noise-turbulence.png',
      noiseTileSize: 200,
      noiseBlendMode: 'soft-light',
    },
    tintHex: 0xf2eee6,
    fogDensity: 0.00016,
    listAlpha: 1,
    description: '控えめノイズ・淡い暖色',
  },
  'cultish-heavy': {
    presetId: 'cultish-heavy',
    background: {
      color: BG,
      gradientTop: BG_TOP,
      gradientBottom: BG_BOTTOM,
      gradientOpacity: 0.2,
      noiseEnabled: true,
      noiseOpacity: 0.22,
      noiseTextureUrl: '/textures/noise-turbulence.png',
      noiseTileSize: 200,
      noiseBlendMode: 'soft-light',
    },
    tintHex: 0xdcd6cc,
    fogDensity: 0.00028,
    listAlpha: 0.96,
    description: '強めノイズ・やや暗め',
  },
  'soft-tint': {
    presetId: 'soft-tint',
    background: {
      color: BG,
      gradientTop: BG_TOP,
      gradientBottom: BG_BOTTOM,
      gradientOpacity: 0.12,
      noiseEnabled: true,
      noiseOpacity: 0.14,
      noiseTextureUrl: '/textures/noise-turbulence.png',
      noiseTileSize: 200,
      noiseBlendMode: 'soft-light',
    },
    tintHex: 0xe8e2d8,
    fogDensity: 0.00018,
    listAlpha: 1,
    description: 'DF デフォルト暖色ティント',
  },
};

export const DEFAULT_PRESET: VisualPresetId = 'soft-tint';

export function getVisualConfig(presetId: VisualPresetId): DfVisualConfig {
  return structuredClone(VISUAL_PRESETS[presetId]);
}
