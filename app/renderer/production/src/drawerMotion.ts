/** 0820 / DI CategoryDrawer motion. CSS implements these values (no framer-motion in production). */

export type EasingBezier = readonly [number, number, number, number];

export const EASE_DRAWER_IN_QUAD: EasingBezier = [0.32, 0, 0.58, 0.02];

export const DRAWER_MOTION = {
  widthCss: 'calc(100vw / 3)',
  durationMs: 260,
  closeMs: 230,
  easing: EASE_DRAWER_IN_QUAD,
  easingCss: 'cubic-bezier(0.32, 0, 0.58, 0.02)',
  showScrimDefault: true,
  initial: { x: 12, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: 7.2, opacity: 0 },
} as const;

export const DRAWER_SCRIM_MOTION = {
  durationMs: 220,
  easing: EASE_DRAWER_IN_QUAD,
  easingCss: 'cubic-bezier(0.32, 0, 0.58, 0.02)',
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
} as const;
