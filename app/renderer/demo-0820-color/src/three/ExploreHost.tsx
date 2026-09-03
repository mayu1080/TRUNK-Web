import { useEffect, useRef, useState } from 'react';
import type { ContentLoadStatus, ImageZoomLoadStatus, ListDebugStats, SelectedDemoCard } from '../types';
import { BubbleOverlay } from '../ui/BubbleOverlay';
import { ExploreController } from './exploreController';

interface ExploreHostProps {
  onStats: (stats: ListDebugStats) => void;
  onCardTap: (card: SelectedDemoCard) => void;
  onContentSettled: (status: ContentLoadStatus) => void;
  interactionEnabled: boolean;
  overlayOpen: boolean;
  imageZoomLoadStatus: ImageZoomLoadStatus;
}

function isSettledStatus(status: ContentLoadStatus): boolean {
  return status === 'loaded' || status === 'error' || status === 'fallback';
}

export function ExploreHost({
  onStats,
  onCardTap,
  onContentSettled,
  interactionEnabled,
  overlayOpen,
  imageZoomLoadStatus,
}: ExploreHostProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<ExploreController | null>(null);
  const onStatsRef = useRef(onStats);
  const onCardTapRef = useRef(onCardTap);
  const onContentSettledRef = useRef(onContentSettled);
  onStatsRef.current = onStats;
  onCardTapRef.current = onCardTap;
  onContentSettledRef.current = onContentSettled;
  const loadStatusRef = useRef<string>('idle');
  const [banner, setBanner] = useState<{ kind: 'loading' | 'error'; text: string } | null>({
    kind: 'loading',
    text: 'loading content images…',
  });

  const getBubbleState = useRef(() => controllerRef.current?.getBubbleState() ?? null).current;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;

    const notifySettled = (status: ContentLoadStatus) => {
      if (cancelled || !isSettledStatus(status)) return;
      onContentSettledRef.current(status);
    };

    const controller = new ExploreController({
      onStats(stats) {
        onStatsRef.current(stats);
        if (stats.contentLoadStatus === loadStatusRef.current) return;
        loadStatusRef.current = stats.contentLoadStatus;
        if (stats.contentLoadStatus === 'loading' || stats.contentLoadStatus === 'idle') {
          setBanner({ kind: 'loading', text: 'loading content images…' });
        } else if (stats.contentLoadStatus === 'error' || stats.contentLoadStatus === 'fallback') {
          setBanner({
            kind: 'error',
            text: stats.contentError || 'content images unavailable — showing fallback cards',
          });
        } else {
          setBanner(null);
        }
        notifySettled(stats.contentLoadStatus);
      },
      onReady() {
        void window.trunkApi?.logEvent?.({
          level: 'info',
          message: '0820 three list ready',
          context: { phase: 8, canvasCount: 1 },
        });
      },
      onCardTap(card) {
        onCardTapRef.current(card);
      },
    });
    controllerRef.current = controller;
    void controller.init(host).then(() => {
      notifySettled(controller.getContentLoadStatus());
    });

    return () => {
      cancelled = true;
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.setOverlayOpen(overlayOpen);
    controllerRef.current?.setInteractionEnabled(interactionEnabled);
  }, [overlayOpen, interactionEnabled]);

  useEffect(() => {
    controllerRef.current?.setImageZoomLoadStatus(imageZoomLoadStatus);
  }, [imageZoomLoadStatus]);

  return (
    <>
      <div
        className="three-layer"
        ref={hostRef}
        data-explore-host="phase-6.5"
        style={{ pointerEvents: interactionEnabled ? 'auto' : 'none' }}
      />
      <BubbleOverlay getState={getBubbleState} />
      {banner && interactionEnabled && (
        <div
          className={`list-status-banner list-status-banner--${banner.kind}`}
          role={banner.kind === 'error' ? 'alert' : 'status'}
        >
          {banner.text}
        </div>
      )}
    </>
  );
}
