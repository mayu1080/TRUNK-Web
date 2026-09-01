export const DESIGN_WIDTH = 1080;
export const DESIGN_HEIGHT = 1920;

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** フルHD縦相当を基準。4K CSS px でも 0.75〜2.0 に収める。 */
export function computeUiScale(innerWidth: number, innerHeight: number): number {
  return clamp(Math.min(innerWidth / DESIGN_WIDTH, innerHeight / DESIGN_HEIGHT), 0.75, 2.0);
}
