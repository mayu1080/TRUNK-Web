import { Application } from 'pixi.js';
import type { ExploreView } from './types';

export interface PixiAppHandle {
  app: Application;
  canvas: HTMLCanvasElement;
  rendererType: string;
}

export async function createPixiApp(host: HTMLElement, bgColor: string): Promise<PixiAppHandle> {
  const app = new Application();
  const initStart = performance.now();

  await app.init({
    background: bgColor,
    backgroundAlpha: 1,
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
    console.error('[DD] WebGL Context Lost');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    console.warn('[DD] WebGL Context Restored');
  });

  return { app, canvas, rendererType: app.renderer.constructor.name };
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
