import { AnimatePresence, motion } from 'framer-motion';
import { IMAGE_ZOOM_MOTION, SCRIM_MOTION } from '../motionConfig';
import { resolveZoomContent } from './zoomContent';

interface ImageZoomOverlayProps {
  open: boolean;
  imageId: string | null;
  imageUrl: string | null;
  closeOnBackdrop: boolean;
  onClose: () => void;
  reviewMode?: boolean;
}

export function ImageZoomOverlay({
  open,
  imageId,
  imageUrl,
  closeOnBackdrop,
  onClose,
  reviewMode = true,
}: ImageZoomOverlayProps) {
  const cardTransition = {
    duration: IMAGE_ZOOM_MOTION.durationMs / 1000,
    ease: IMAGE_ZOOM_MOTION.easing,
  };
  const scrimTransition = {
    duration: SCRIM_MOTION.durationMs / 1000,
    ease: SCRIM_MOTION.easing,
  };

  const content = imageId ? resolveZoomContent(imageId) : null;

  return (
    <AnimatePresence>
      {open && imageId && content && (
        <motion.div
          className="zoom-backdrop"
          initial={SCRIM_MOTION.initial}
          animate={SCRIM_MOTION.animate}
          exit={SCRIM_MOTION.exit}
          transition={scrimTransition}
          onClick={closeOnBackdrop ? onClose : undefined}
          role="dialog"
          aria-modal="true"
          aria-label="Image detail"
        >
          <motion.article
            className="zoom-card"
            initial={IMAGE_ZOOM_MOTION.initial}
            animate={IMAGE_ZOOM_MOTION.animate}
            exit={IMAGE_ZOOM_MOTION.exit}
            transition={cardTransition}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="zoom-card-header">
              <span className="zoom-brand">{content.brand}</span>
              <button
                type="button"
                className="zoom-close"
                aria-label="Close"
                onClick={onClose}
              >
                ×
              </button>
            </header>

            <div className="zoom-image-wrap">
              {imageUrl ? (
                <img className="zoom-image" src={imageUrl} alt="" draggable={false} />
              ) : (
                <div className="zoom-placeholder" />
              )}
            </div>

            <div className="zoom-copy">
              <h2 className="zoom-title">{`“${content.title}”`}</h2>
              <p className="zoom-body">{content.body}</p>
            </div>

            {!reviewMode && (
              <p className="zoom-meta-debug">{imageId}</p>
            )}
          </motion.article>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
