import { useEffect, useRef } from 'react';
import type { ContentLoadStatus, ImageZoomLoadStatus, ListDebugStats, SelectedDemoCard } from '../types';
import { BubbleOverlay } from '../ui/BubbleOverlay';
import { ExploreController, type ExploreViewLayout } from './exploreController';

interface ExploreHostProps {
  layout: ExploreViewLayout;
  onStats: (stats: ListDebugStats) => void;
  onCardTap: (card: SelectedDemoCard) => void;
  onContentSettled: (status: ContentLoadStatus) => void;
  onValidActivity: () => void;
  interactionEnabled: boolean;
  overlayOpen: boolean;
  imageZoomLoadStatus: ImageZoomLoadStatus;
}

function isSettledStatus(status: ContentLoadStatus): boolean {
  return status === 'loaded' || status === 'error' || status === 'fallback';
}

export function ExploreHost({
  layout,
  onStats,
  onCardTap,
  onContentSettled,
  onValidActivity,
  interactionEnabled,
  overlayOpen,
  imageZoomLoadStatus,
}: ExploreHostProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<ExploreController | null>(null);
  const onStatsRef = useRef(onStats);
  const onCardTapRef = useRef(onCardTap);
  const onContentSettledRef = useRef(onContentSettled);
  const onValidActivityRef = useRef(onValidActivity);
  onStatsRef.current = onStats;
  onCardTapRef.current = onCardTap;
  onContentSettledRef.current = onContentSettled;
  onValidActivityRef.current = onValidActivity;
  const loadStatusRef = useRef<string>('idle');

  const getBubbleState = useRef(() => controllerRef.current?.getBubbleState() ?? null).current;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;

    const notifySettled = (status: ContentLoadStatus) => {
      if (cancelled || !isSettledStatus(status)) return;
      onContentSettledRef.current(status);
    };

    const controller = new ExploreController(
      {
        onStats(stats) {
          onStatsRef.current(stats);
          if (stats.contentLoadStatus === loadStatusRef.current) return;
          loadStatusRef.current = stats.contentLoadStatus;
          notifySettled(stats.contentLoadStatus);
        },
        onReady() {
          void window.trunkApi?.logEvent?.({
            level: 'info',
            message: 'production three list ready',
            context: { phase: 5.5, canvasCount: 1, monitorId: layout.monitorId },
          });
        },
        onCardTap(card) {
          onCardTapRef.current(card);
        },
        onValidActivity() {
          onValidActivityRef.current();
        },
      },
      layout,
    );
    controllerRef.current = controller;
    void controller.init(host).then(() => {
      notifySettled(controller.getContentLoadStatus());
    });

    return () => {
      cancelled = true;
      controller.destroy();
      controllerRef.current = null;
    };
  }, [layout.monitorId, layout.viewportOffsetX, layout.viewportOffsetY, layout.scale, layout.orientation, layout.width, layout.height]);

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
        data-explore-host="production-phase-5.5"
        data-monitor-id={layout.monitorId}
        style={{ pointerEvents: interactionEnabled ? 'auto' : 'none' }}
      />
      <BubbleOverlay getState={getBubbleState} monitorId={layout.monitorId} />
    </>
  );
}
