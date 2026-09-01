export type UiDisplayMode = 'review' | 'debug';

export const DEFAULT_UI_MODE: UiDisplayMode = 'review';

export function isDebugMode(mode: UiDisplayMode): boolean {
  return mode === 'debug';
}
