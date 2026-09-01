import { useEffect, useState } from 'react';
import { IMAGE_ZOOM_MOTION } from '../imageZoomMotion';
import type { ImageCopy } from '../imageCopy';
import type { ImageZoomLoadStatus, SelectedDemoCard } from '../types';

interface ImageZoomOverlayProps {
  open: boolean;
  card: SelectedDemoCard | null;
  copy: ImageCopy;
  logoUrl: string | null;
  logoFound: boolean;
  onClose: () => void;
  onLoadStatus: (status: ImageZoomLoadStatus) => void;
}

interface HeldZoom {
  card: SelectedDemoCard | null;
  copy: ImageCopy;
  logoUrl: string | null;
  logoFound: boolean;
}

/** Local overlay only. CLOSE_OVERLAY still applies immediately; this component keeps paint for close ease. */
export function ImageZoomOverlay({
  open,
  card,
  copy,
  logoUrl,
  logoFound,
  onClose,
  onLoadStatus,
}: ImageZoomOverlayProps) {
  const [mounted, setMounted] = useState(open);
  const [openClass, setOpenClass] = useState(open);
  const [held, setHeld] = useState<HeldZoom>({ card, copy, logoUrl, logoFound });
  const [status, setStatus] = useState<ImageZoomLoadStatus>(card?.imageUrl ? 'loading' : 'error');

  useEffect(() => {
    if (open) {
      setHeld({ card, copy, logoUrl, logoFound });
      setMounted(true);
      setOpenClass(false);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setOpenClass(true));
      });
      return () => window.cancelAnimationFrame(frame);
    }
    setOpenClass(false);
    const timer = window.setTimeout(() => setMounted(false), IMAGE_ZOOM_MOTION.closeMs);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setHeld({ card, copy, logoUrl, logoFound });
  }, [open, card, copy, logoUrl, logoFound]);

  const updateStatus = (next: ImageZoomLoadStatus) => {
    setStatus((prev) => (prev === next ? prev : next));
    onLoadStatus(next);
  };

  if (!mounted) return null;

  const shown = open ? { card, copy, logoUrl, logoFound } : held;
  const title = shown.copy.title || shown.card?.title || shown.card?.sourceImageId || '';
  const closing = mounted && !openClass && !open;

  return (
    <div
      className={`image-zoom-overlay${openClass ? ' is-open' : ''}${closing ? ' is-closing' : ''}`}
      role="dialog"
      aria-modal={open}
      aria-label="image zoom"
      onClick={onClose}
    >
      <div
        className="image-zoom-overlay__card"
        data-load-status={status}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="image-zoom-overlay__chrome">
          {shown.logoFound && shown.logoUrl ? (
            <div className="image-zoom-overlay__logo" aria-hidden="true">
              <img className="image-zoom-overlay__logo-image" src={shown.logoUrl} alt="" draggable={false} />
            </div>
          ) : (
            <span className="image-zoom-overlay__logo-spacer" aria-hidden="true" />
          )}
          <button
            type="button"
            className="image-zoom-overlay__close-corner"
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            aria-label="close"
          >
            <span className="image-zoom-overlay__close-glyph" aria-hidden="true">
              ×
            </span>
          </button>
        </div>
        <div className="image-zoom-overlay__frame">
          {shown.card?.imageUrl ? (
            <img
              className="image-zoom-overlay__image"
              src={shown.card.imageUrl}
              alt={title}
              onLoad={() => updateStatus('loaded')}
              onError={() => updateStatus('error')}
              ref={(img) => {
                if (!img) return;
                if (img.complete && img.naturalWidth > 0) updateStatus('loaded');
                if (img.complete && img.naturalWidth === 0) updateStatus('error');
              }}
            />
          ) : (
            <p className="image-zoom-overlay__fallback">no imageUrl</p>
          )}
        </div>
        <div className="image-zoom-overlay__copy">
          {shown.copy.categoryLabel ? <p className="image-zoom-overlay__kicker">{shown.copy.categoryLabel}</p> : null}
          <h2 className="image-zoom-overlay__title">{title}</h2>
          <p className="image-zoom-overlay__description">{shown.copy.description}</p>
        </div>
      </div>
    </div>
  );
}
