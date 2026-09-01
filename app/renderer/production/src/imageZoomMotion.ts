import { DRAWER_MOTION, DRAWER_SCRIM_MOTION } from './drawerMotion';

/** IMAGE_ZOOM uses CategoryDrawer timing / easing. Translate is Y instead of X. */

export const IMAGE_ZOOM_EASE_CSS = DRAWER_MOTION.easingCss;

export const IMAGE_ZOOM_MOTION = {
  durationMs: DRAWER_MOTION.durationMs,
  closeMs: DRAWER_MOTION.closeMs,
  scrimMs: DRAWER_SCRIM_MOTION.durationMs,
  easingCss: IMAGE_ZOOM_EASE_CSS,
  initial: { y: DRAWER_MOTION.initial.x, scale: 1, opacity: 0 },
  animate: { y: 0, scale: 1, opacity: 1 },
  exit: { y: DRAWER_MOTION.exit.x, scale: 1, opacity: 0 },
} as const;
