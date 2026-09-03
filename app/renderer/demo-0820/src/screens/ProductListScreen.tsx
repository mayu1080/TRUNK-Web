import type { ContentLoadStatus, ImageZoomLoadStatus, ListDebugStats, SelectedDemoCard } from '../types';
import { ExploreHost } from '../three/ExploreHost';

interface ProductListScreenProps {
  onStats: (stats: ListDebugStats) => void;
  onCardTap: (card: SelectedDemoCard) => void;
  onContentSettled: (status: ContentLoadStatus) => void;
  interactionEnabled: boolean;
  overlayOpen: boolean;
  imageZoomLoadStatus: ImageZoomLoadStatus;
  warmup: boolean;
}

export function ProductListScreen({
  onStats,
  onCardTap,
  onContentSettled,
  interactionEnabled,
  overlayOpen,
  imageZoomLoadStatus,
  warmup,
}: ProductListScreenProps) {
  return (
    <div
      className="screen-panel screen-panel--list"
      data-warmup={warmup ? 'true' : 'false'}
      aria-hidden={warmup}
    >
      <ExploreHost
        onStats={onStats}
        onCardTap={onCardTap}
        onContentSettled={onContentSettled}
        interactionEnabled={interactionEnabled}
        overlayOpen={overlayOpen}
        imageZoomLoadStatus={imageZoomLoadStatus}
      />
    </div>
  );
}
