export type UiDisplayMode = 'review' | 'debug';

export function isDebugMode(mode: UiDisplayMode): boolean {
  return mode === 'debug';
}
