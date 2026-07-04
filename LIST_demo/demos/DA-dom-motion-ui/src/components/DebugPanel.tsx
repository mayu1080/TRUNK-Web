import { DRAWER_MOTION, IMAGE_ZOOM_MOTION } from '../motionConfig';
import type { OverlayState } from '../types';

interface DebugPanelProps {
  overlayState: OverlayState;
  isImageZoomOpen: boolean;
  isCategoryDrawerOpen: boolean;
  selectedImageId: string | null;
  selectedImageUrl: string | null;
  selectedCategoryId: string | null;
  pointerBlocked: boolean;
  lastAction: string;
  closeOnBackdrop: boolean;
  showDrawerScrim: boolean;
  indexLoaded: boolean;
}

export function DebugPanel({
  overlayState,
  isImageZoomOpen,
  isCategoryDrawerOpen,
  selectedImageId,
  selectedImageUrl,
  selectedCategoryId,
  pointerBlocked,
  lastAction,
  closeOnBackdrop,
  showDrawerScrim,
  indexLoaded,
}: DebugPanelProps) {
  const lines = [
    '=== DA: DOM + Motion UI ===',
    'mode: A (DOM mock LIST — Pixiなし)',
    'url: http://localhost:5174',
    `asset index: ${indexLoaded ? 'loaded' : 'fallback'}`,
    `overlay state: ${overlayState}`,
    `isImageZoomOpen: ${isImageZoomOpen}`,
    `isCategoryDrawerOpen: ${isCategoryDrawerOpen}`,
    `selectedImageId: ${selectedImageId ?? '(none)'}`,
    `selectedImageUrl: ${selectedImageUrl ?? '(none)'}`,
    `selectedCategoryId: ${selectedCategoryId ?? '(none)'}`,
    `pointer blocked: ${pointerBlocked}`,
    `last action: ${lastAction}`,
    '',
    'motion:',
    `  zoom duration: ${IMAGE_ZOOM_MOTION.durationMs}ms`,
    `  drawer duration: ${DRAWER_MOTION.durationMs}ms`,
    `  drawer width: ${DRAWER_MOTION.widthPx}px`,
    '',
    'flags:',
    `  closeOnBackdrop: ${closeOnBackdrop}`,
    `  drawerScrim: ${showDrawerScrim}`,
  ];

  return <pre className="debug-panel">{lines.join('\n')}</pre>;
}
