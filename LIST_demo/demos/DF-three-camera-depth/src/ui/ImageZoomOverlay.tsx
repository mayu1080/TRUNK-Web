import type { CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { IMAGE_ZOOM_MOTION, MOTION_CONFIG } from '../motionConfig';
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
  const zoom = MOTION_CONFIG.imageZoomOpen;
  const cardOpenTransition = {
    duration: zoom.cardFadeMs / 1000,
    delay: zoom.cardDelayMs / 1000,
    ease: zoom.cardEasing,
  };
  const cardCloseTransition = {
    duration: (zoom.cardFadeMs * 0.85) / 1000,
    delay: 0,
    ease: zoom.cardEasing,
  };
  const scrimTransition = {
    duration: zoom.scrimFadeMs / 1000,
    ease: zoom.scrimEasing,
  };
  const backdropStyle = {
    '--zoom-scrim-max': zoom.scrimOpacityMax,
    '--zoom-scrim-blur': `${zoom.scrimBlurPx}px`,
  } as CSSProperties;

  const content = imageId ? resolveZoomContent(imageId) : null;

  return (
    <AnimatePresence>
      {open && imageId && content && (
        <motion.div
          className="zoom-backdrop"
          style={backdropStyle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
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
            exit={{ ...IMAGE_ZOOM_MOTION.exit, transition: cardCloseTransition }}
            transition={cardOpenTransition}
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
