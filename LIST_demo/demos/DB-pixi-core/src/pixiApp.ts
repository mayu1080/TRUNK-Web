import { Application } from 'pixi.js';
import type { ExploreView } from './types';

export interface PixiAppHandle {
  app: Application;
  canvas: HTMLCanvasElement;
  rendererType: string;
}

export async function createPixiApp(host: HTMLElement): Promise<PixiAppHandle> {
  const app = new Application();
  const initStart = performance.now();

  await app.init({
    background: '#0a0a0a',
    resizeTo: host,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  host.appendChild(app.canvas);

  const initTimeMs = performance.now() - initStart;
  (app.canvas as HTMLCanvasElement & { __initTimeMs?: number }).__initTimeMs = initTimeMs;

  const canvas = app.canvas as HTMLCanvasElement;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    console.error('[DB-pixi-core] WebGL Context Lost');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    console.warn('[DB-pixi-core] WebGL Context Restored');
  });

  const rendererType = app.renderer.constructor.name;

  return { app, canvas, rendererType };
}

export function getInitTimeMs(canvas: HTMLCanvasElement): number {
  return (canvas as HTMLCanvasElement & { __initTimeMs?: number }).__initTimeMs ?? 0;
}

export function centerInitialView(
  app: Application,
  view: ExploreView,
  worldWidth: number,
  worldHeight: number,
): ExploreView {
  const sw = app.screen.width;
  const sh = app.screen.height;
  return {
    ...view,
    panX: sw / 2 - (worldWidth / 2) * view.zoom,
    panY: sh / 2 - (worldHeight / 2) * view.zoom,
  };
}
