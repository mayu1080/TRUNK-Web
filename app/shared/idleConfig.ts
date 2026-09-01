import type { ScreenState } from './state';

/** 本番タイムアウト: 10分（600秒）。変更はここだけ。 */
export const PRODUCTION_IDLE_TIMEOUT_SECONDS = 600;

/** Production shell (`TRUNK_DEMO=production`) 全体 Non-Touch。0820 の 10分とは別。 */
export const PRODUCTION_SHELL_IDLE_TIMEOUT_SECONDS = 120;

/** 開発・テスト用デフォルト（npm start 時。本番ビルドには含まれない） */
export const DEVELOPMENT_IDLE_TIMEOUT_SECONDS = 20;

/** 無操作スリープの対象 screenState（docs/screen-flow.json と一致） */
export const IDLE_TIMEOUT_SCREEN_STATES: ScreenState[] = [
  'PRODUCT_LIST',
  'IMAGE_ZOOM',
  'PRODUCT_DETAIL',
];

export function isIdleTimeoutApplicable(screenState: ScreenState): boolean {
  return IDLE_TIMEOUT_SCREEN_STATES.includes(screenState);
}

export interface IdleTimeoutConfig {
  /** 秒 */
  seconds: number;
  /** production = 本番値。development = 非パッケージ時の TRUNK_IDLE_TIMEOUT_SECONDS 上書き */
  source: 'production' | 'development';
}

/**
 * タイムアウト秒数を解決する。
 *
 * 本番（isPackaged=true）: 常に PRODUCTION_IDLE_TIMEOUT_SECONDS（600秒）
 * 開発（isPackaged=false）: デフォルト DEVELOPMENT_IDLE_TIMEOUT_SECONDS（20秒）
 *   環境変数 TRUNK_IDLE_TIMEOUT_SECONDS で上書き可
 */
export function resolveIdleTimeoutConfig(isPackaged: boolean): IdleTimeoutConfig {
  if (isPackaged) {
    return { seconds: PRODUCTION_IDLE_TIMEOUT_SECONDS, source: 'production' };
  }

  const override = process.env.TRUNK_IDLE_TIMEOUT_SECONDS;
  if (override !== undefined && override.trim() !== '') {
    const parsed = Number(override.trim());
    if (Number.isFinite(parsed) && parsed > 0) {
      return { seconds: parsed, source: 'development' };
    }
  }

  return { seconds: DEVELOPMENT_IDLE_TIMEOUT_SECONDS, source: 'development' };
}

/**
 * Production shell の全体 Non-Touch。
 * packaged: 120秒固定。dev: TRUNK_PRODUCTION_IDLE_SECONDS、なければ TRUNK_IDLE_TIMEOUT_SECONDS、なければ 20秒。
 * 0820 の resolveIdleTimeoutConfig（packaged 600秒）は変更しない。
 */
export function resolveProductionShellIdleTimeout(isPackaged: boolean): IdleTimeoutConfig {
  if (isPackaged) {
    return { seconds: PRODUCTION_SHELL_IDLE_TIMEOUT_SECONDS, source: 'production' };
  }

  const override = process.env.TRUNK_PRODUCTION_IDLE_SECONDS ?? process.env.TRUNK_IDLE_TIMEOUT_SECONDS;
  if (override !== undefined && override.trim() !== '') {
    const parsed = Number(override.trim());
    if (Number.isFinite(parsed) && parsed > 0) {
      return { seconds: parsed, source: 'development' };
    }
  }

  return { seconds: DEVELOPMENT_IDLE_TIMEOUT_SECONDS, source: 'development' };
}
