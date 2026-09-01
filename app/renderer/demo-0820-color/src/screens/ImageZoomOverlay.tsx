import { useState } from 'react';
import type { ImageZoomLoadStatus, SelectedDemoCard } from '../types';

interface ImageZoomOverlayProps {
  card: SelectedDemoCard;
  onClose: () => void;
  onLoadStatus: (status: ImageZoomLoadStatus) => void;
}

export function ImageZoomOverlay({ card, onClose, onLoadStatus }: ImageZoomOverlayProps) {
  const [status, setStatus] = useState<ImageZoomLoadStatus>(card.imageUrl ? 'loading' : 'error');

  const updateStatus = (next: ImageZoomLoadStatus) => {
    setStatus((prev) => (prev === next ? prev : next));
    onLoadStatus(next);
  };

  return (
    <div className="image-zoom-overlay" role="dialog" aria-label="image zoom">
      <button type="button" className="image-zoom-overlay__close" onClick={onClose} aria-label="close">
        ×
      </button>
      <div className="image-zoom-overlay__stage">
        {card.imageUrl ? (
          <img
            className="image-zoom-overlay__image"
            src={card.imageUrl}
            alt={card.title || card.sourceImageId}
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
        {status === 'loading' && <p className="image-zoom-overlay__status">loading image…</p>}
        {status === 'error' && <p className="image-zoom-overlay__status">image failed to load</p>}
      </div>
      <p className="image-zoom-overlay__meta">
        {card.title || card.sourceImageId}
        <span>
          {card.instanceId} · {card.sourceImageId}
        </span>
      </p>
    </div>
  );
}
