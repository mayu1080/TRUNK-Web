import { DRAWER_MOTION, DRAWER_SCRIM_MOTION } from './drawerMotion';

/** Category modal card uses Drawer timing. Slight Y + scale, like a quieter IMAGE_ZOOM. */

export const SQUARE_LOGO_RELATIVE_PATH = 'Logo/LOGO_Square.png';

export const CATEGORY_MODAL_MOTION = {
  durationMs: DRAWER_MOTION.durationMs,
  closeMs: DRAWER_MOTION.closeMs,
  scrimMs: DRAWER_SCRIM_MOTION.durationMs,
  easingCss: DRAWER_MOTION.easingCss,
  initial: { y: DRAWER_MOTION.initial.x, scale: 0.985, opacity: 0 },
  animate: { y: 0, scale: 1, opacity: 1 },
  exit: { y: DRAWER_MOTION.exit.x, scale: 0.99, opacity: 0 },
} as const;
