import type { PlacedImage } from './exploreScene';
import type { VisualConfig } from '../visualConfig';
import { mapClientToRenderer } from './pointerCoords';

export interface TouchReactionState {
  pointerX: number;
  pointerY: number;
  dragging: boolean;
  active: boolean;
}

export function createTouchReactionState(): TouchReactionState {
  return { pointerX: 0, pointerY: 0, dragging: false, active: false };
}

export function updateTouchReactionFromEvent(
  state: TouchReactionState,
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  dragging: boolean,
): void {
  const p = mapClientToRenderer(canvas, clientX, clientY);
  state.pointerX = p.x;
  state.pointerY = p.y;
  state.dragging = dragging;
  state.active = true;
}

export function clearTouchReaction(state: TouchReactionState): void {
  state.active = false;
  state.dragging = false;
}

/** 近傍画像への微反応 + ドラッグ遅延 */
export function applyTouchReaction(
  images: PlacedImage[],
  state: TouchReactionState,
  worldPanX: number,
  worldPanY: number,
  zoom: number,
  config: VisualConfig,
  time: number,
): void {
  if (!config.touchReaction.enabled || !state.active) {
    for (const item of images) {
      item.reactionScale = 1;
      item.reactionOffsetX = 0;
      item.reactionOffsetY = 0;
    }
    return;
  }

  const { strength, radius, lag } = config.touchReaction;
  const worldX = (state.pointerX - worldPanX) / zoom;
  const worldY = (state.pointerY - worldPanY) / zoom;

  for (const item of images) {
    const dx = worldX - item.baseX;
    const dy = worldY - item.baseY;
    const dist = Math.hypot(dx, dy);
    const falloff = Math.max(0, 1 - dist / radius);
    const push = falloff * strength;

    item.reactionScale = 1 + push * 0.12;
    if (state.dragging) {
      item.reactionOffsetX += (dx * lag * push * 0.08 - item.reactionOffsetX) * 0.15;
      item.reactionOffsetY += (dy * lag * push * 0.08 - item.reactionOffsetY) * 0.15;
    } else {
      item.reactionOffsetX *= 0.85;
      item.reactionOffsetY *= 0.85;
    }
    void time;
  }
}

export async function animateTapFocus(
  item: PlacedImage,
  config: VisualConfig,
): Promise<void> {
  if (!config.tapFocus.enabled) return;

  const { scale, durationMs } = config.tapFocus;
  const start = performance.now();

  return new Promise((resolve) => {
    const tick = () => {
      const t = Math.min((performance.now() - start) / durationMs, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      item.tapFocusScale = 1 + (scale - 1) * Math.sin(ease * Math.PI);
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        item.tapFocusScale = 1;
        item.tapFocusBright = 1;
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });
}
