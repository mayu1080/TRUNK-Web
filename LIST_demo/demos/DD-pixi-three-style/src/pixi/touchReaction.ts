import { easeOutCubic, MOTION_CONFIG } from '../motionConfig';
import type { PlacedImage } from './exploreScene';
import { applyImageTone } from './exploreScene';
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

    item.reactionScale = 1 + push * 0.08;
    if (state.dragging) {
      item.reactionOffsetX += (dx * lag * push * 0.06 - item.reactionOffsetX) * 0.12;
      item.reactionOffsetY += (dy * lag * push * 0.06 - item.reactionOffsetY) * 0.12;
    } else {
      item.reactionOffsetX *= 0.88;
      item.reactionOffsetY *= 0.88;
    }
    void time;
  }
}

/** タップ確定後: 選択画像を静かに明るく（scale なし・非ブロッキング） */
export async function animateTapFocus(
  item: PlacedImage,
  config: VisualConfig,
): Promise<void> {
  const tap = MOTION_CONFIG.tapReaction;
  if (!tap.enabled) return;

  const { riseMs, holdMs, scaleTo, brighten } = tap;
  const start = performance.now();
  const totalMs = riseMs + holdMs;

  return new Promise((resolve) => {
    const tick = () => {
      const elapsed = performance.now() - start;

      if (elapsed < riseMs) {
        const t = easeOutCubic(elapsed / riseMs);
        item.tapFocusScale = 1 + (scaleTo - 1) * t;
        item.tapFocusBright = 1 + brighten * t;
      } else {
        item.tapFocusScale = scaleTo;
        item.tapFocusBright = 1 + brighten;
      }

      applyImageTone(item.greyFilter, config, item.tapFocusBright);

      if (elapsed >= totalMs) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** ZOOM 開始と並行 — await しない */
export function startTapFocus(item: PlacedImage, config: VisualConfig): void {
  void animateTapFocus(item, config);
}

/** ZOOM 閉じた後にタップ反応状態をリセット */
export function resetTapFocus(item: PlacedImage, config: VisualConfig): void {
  item.tapFocusScale = 1;
  item.tapFocusBright = 1;
  applyImageTone(item.greyFilter, config);
}
