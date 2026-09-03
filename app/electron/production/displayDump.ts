import type { Display } from 'electron';

export const PREVIEW_ENV_KEYS = [
  'TRUNK_PRODUCTION_PREVIEW',
  'TRUNK_PREVIEW',
  'TRUNK_PRODUCTION_PREVIEW_MODE',
  'TRUNK_PRODUCTION_PREVIEW_SCALE',
  'TRUNK_PRODUCTION_PREVIEW_WINDOWS',
  'TRUNK_PRODUCTION_PREVIEW_FRAME',
] as const;

export function leftoverPreviewEnv(env: NodeJS.ProcessEnv): string[] {
  return PREVIEW_ENV_KEYS.filter((key) => {
    const value = env[key];
    return value != null && String(value).trim() !== '';
  });
}

export function dumpDisplay(display: Display): Record<string, unknown> {
  const extra = display as Display & {
    size?: { width: number; height: number };
    workAreaSize?: { width: number; height: number };
    rotation?: number;
    touchSupport?: string;
    accelerometerSupport?: string;
    displayFrequency?: number;
  };
  return {
    id: display.id,
    bounds: { ...display.bounds },
    workArea: { ...display.workArea },
    size: extra.size ? { ...extra.size } : { width: display.bounds.width, height: display.bounds.height },
    workAreaSize: extra.workAreaSize
      ? { ...extra.workAreaSize }
      : { width: display.workArea.width, height: display.workArea.height },
    scaleFactor: display.scaleFactor,
    rotation: extra.rotation ?? 0,
    touchSupport: extra.touchSupport ?? 'unknown',
    accelerometerSupport: extra.accelerometerSupport ?? 'unknown',
    internal: Boolean(display.internal),
    displayFrequency: extra.displayFrequency ?? null,
  };
}

export function parseSiteAutoBounds(env: NodeJS.ProcessEnv): boolean {
  const value = (env.TRUNK_SITE_AUTO_BOUNDS ?? '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'on' || value === 'site';
}

export function parseProductionFullscreen(env: NodeJS.ProcessEnv, options: { allow: boolean }): boolean {
  if (!options.allow) return false;
  const value = (env.TRUNK_PRODUCTION_FULLSCREEN ?? '1').trim().toLowerCase();
  if (value === '0' || value === 'false' || value === 'off') return false;
  return true;
}
