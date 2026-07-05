/** LIST 探索画像トーン — Sprite フィルタ用（ワールドには適用しない） */

export type TonePresetId = 'original-dd' | 'safe-soft-mono';

export interface TonePreset {
  description: string;
  brightness: number;
  contrast: number;
}

export const TONE_PRESETS: Record<TonePresetId, TonePreset> = {
  'original-dd': {
    description: 'DDの前回安定状態に近いトーン',
    brightness: 1.24,
    contrast: 0.86,
  },
  'safe-soft-mono': {
    description: '今回の安全な柔らかいモノクロ（ややソフト）',
    brightness: 1.24,
    contrast: 0.27,
  },
};

export const DEFAULT_TONE_PRESET: TonePresetId = 'safe-soft-mono';

export const TONE_PRESET_IDS = Object.keys(TONE_PRESETS) as TonePresetId[];

export function applyTonePresetToImage<T extends { brightness: number; contrast: number }>(
  image: T,
  tonePresetId: TonePresetId,
): T {
  const tone = TONE_PRESETS[tonePresetId];
  return {
    ...image,
    brightness: tone.brightness,
    contrast: tone.contrast,
  };
}
