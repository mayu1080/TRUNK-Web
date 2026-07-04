import { Point } from 'pixi.js';

/**
 * client 座標 → Pixi renderer 座標（autoDensity / devicePixelRatio 補正）
 * pan / zoom / ヒットテストはすべてこの座標系で統一する。
 */
export function mapClientToRenderer(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  out = new Point(),
): Point {
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
  const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
  out.x = (clientX - rect.left) * scaleX;
  out.y = (clientY - rect.top) * scaleY;
  return out;
}

export function mapClientDeltaToRenderer(
  canvas: HTMLCanvasElement,
  deltaX: number,
  deltaY: number,
): { dx: number; dy: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
  const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
  return { dx: deltaX * scaleX, dy: deltaY * scaleY };
}
