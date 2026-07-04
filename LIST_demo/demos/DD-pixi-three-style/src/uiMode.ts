/** UI 表示モード — Visual Polish Pass 01 */

export type UiDisplayMode = 'review' | 'debug';

/** 先方レビュー用デフォルト */
export const DEFAULT_UI_MODE: UiDisplayMode = 'review';

export function isReviewMode(mode: UiDisplayMode): boolean {
  return mode === 'review';
}

export function isDebugMode(mode: UiDisplayMode): boolean {
  return mode === 'debug';
}
