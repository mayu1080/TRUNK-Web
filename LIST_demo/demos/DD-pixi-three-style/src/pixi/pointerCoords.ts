import { Point } from 'pixi.js';

/**
 * client 座標 → Pixi screen 座標（app.screen / worldTransform と同じ空間）
 *
 * Pixi EventSystem.mapPositionToPoint と同じ式:
 *   (client - rect) * (canvas.width / rect.width) / resolution
 *
 * canvas.width はバッファピクセル。resolution で割らないと DPR>1 で
 * hit bounds（CSS/screen 空間）とズレる。
 */
export function mapClientToRenderer(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  out = new Point(),
  resolution = getCanvasResolution(canvas),
): Point {
  const rect = canvas.getBoundingClientRect();
  const resolutionMultiplier = 1 / Math.max(resolution, 1e-6);
  const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
  const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
  out.x = (clientX - rect.left) * scaleX * resolutionMultiplier;
  out.y = (clientY - rect.top) * scaleY * resolutionMultiplier;
  return out;
}

/** canvas 中心を renderer 座標で返す */
export function mapCanvasCenterToRenderer(
  canvas: HTMLCanvasElement,
  out = new Point(),
  resolution = getCanvasResolution(canvas),
): Point {
  const rect = canvas.getBoundingClientRect();
  return mapClientToRenderer(
    canvas,
    rect.left + rect.width / 2,
    rect.top + rect.height / 2,
    out,
    resolution,
  );
}

export function mapClientDeltaToRenderer(
  canvas: HTMLCanvasElement,
  deltaX: number,
  deltaY: number,
  resolution = getCanvasResolution(canvas),
): { dx: number; dy: number } {
  const rect = canvas.getBoundingClientRect();
  const resolutionMultiplier = 1 / Math.max(resolution, 1e-6);
  const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
  const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
  return {
    dx: deltaX * scaleX * resolutionMultiplier,
    dy: deltaY * scaleY * resolutionMultiplier,
  };
}

/** renderer 座標 → client（CSS px）— デバッグ可視化用 */
export function mapRendererToClient(
  canvas: HTMLCanvasElement,
  rendererX: number,
  rendererY: number,
  resolution = getCanvasResolution(canvas),
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX =
    canvas.width > 0 ? (rect.width * resolution) / canvas.width : 1;
  const scaleY =
    canvas.height > 0 ? (rect.height * resolution) / canvas.height : 1;
  return {
    x: rect.left + rendererX * scaleX,
    y: rect.top + rendererY * scaleY,
  };
}

function getCanvasResolution(canvas: HTMLCanvasElement): number {
  const stored = (canvas as HTMLCanvasElement & { __pixiResolution?: number })
    .__pixiResolution;
  if (typeof stored === 'number' && stored > 0) return stored;
  return window.devicePixelRatio || 1;
}

/** Application 作成後に canvas へ resolution を紐づける */
export function bindCanvasResolution(
  canvas: HTMLCanvasElement,
  resolution: number,
): void {
  (canvas as HTMLCanvasElement & { __pixiResolution?: number }).__pixiResolution =
    resolution;
}
