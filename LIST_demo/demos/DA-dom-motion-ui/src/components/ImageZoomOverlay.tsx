import { AnimatePresence, motion } from 'framer-motion';
import { IMAGE_ZOOM_MOTION, SCRIM_MOTION } from '../motionConfig';

interface ImageZoomOverlayProps {
  open: boolean;
  imageId: string | null;
  imageUrl: string | null;
  closeOnBackdrop: boolean;
  onClose: () => void;
}

export function ImageZoomOverlay({
  open,
  imageId,
  imageUrl,
  closeOnBackdrop,
  onClose,
}: ImageZoomOverlayProps) {
  const cardTransition = {
    duration: IMAGE_ZOOM_MOTION.durationMs / 1000,
    ease: IMAGE_ZOOM_MOTION.easing,
  };

  const scrimTransition = {
    duration: SCRIM_MOTION.durationMs / 1000,
    ease: SCRIM_MOTION.easing,
  };

  return (
    <AnimatePresence>
      {open && imageId && (
        <motion.div
          className="zoom-backdrop"
          initial={SCRIM_MOTION.initial}
          animate={SCRIM_MOTION.animate}
          exit={SCRIM_MOTION.exit}
          transition={scrimTransition}
          onClick={closeOnBackdrop ? onClose : undefined}
          role="dialog"
          aria-modal="true"
          aria-label="IMAGE_ZOOM demo"
        >
          <motion.div
            className="zoom-card"
            initial={IMAGE_ZOOM_MOTION.initial}
            animate={IMAGE_ZOOM_MOTION.animate}
            exit={IMAGE_ZOOM_MOTION.exit}
            transition={cardTransition}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>IMAGE_ZOOM (demo)</h2>
            <p className="meta">{`selectedImageId: ${imageId}`}</p>
            {imageUrl ? (
              <img className="zoom-image" src={imageUrl} alt="" draggable={false} />
            ) : (
              <div className="zoom-placeholder">仮画像プレビュー</div>
            )}
            <button type="button" className="touch-btn primary-close" onClick={onClose}>
              Close ×
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
