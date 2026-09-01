import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_BUBBLE_MOTION,
  type BubbleMotionId,
  type BubbleRuntimeState,
} from './bubbleConfig';
import { ExploreController } from './three/exploreController';
import type { HitTestDebugSnapshot } from './three/hitTestDiagnostics';
import type { DebugStats } from './types';
import { CLOSE_ON_BACKDROP_DEFAULT, DRAWER_MOTION, type OverlayState } from './motionConfig';
import { BubbleOverlay } from './ui/BubbleOverlay';
import { CategoryDrawer } from './ui/CategoryDrawer';
import { DebugPanel } from './ui/DebugPanel';
import { DemoBanner } from './ui/DemoBanner';
import { DemoToggles } from './ui/DemoToggles';
import { HitTestDebugOverlay } from './ui/HitTestDebugOverlay';
import { ImageZoomOverlay } from './ui/ImageZoomOverlay';
import { NoiseOverlay } from './ui/NoiseOverlay';
import { DEFAULT_UI_MODE, isDebugMode, type UiDisplayMode } from './uiMode';
import { DEFAULT_PRESET, getVisualConfig, type VisualPresetId } from './visualConfig';

export function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<ExploreController | null>(null);

  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState<DebugStats | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [uiMode, setUiMode] = useState<UiDisplayMode>(DEFAULT_UI_MODE);
  const reviewMode = !isDebugMode(uiMode);

  const [presetId, setPresetId] = useState<VisualPresetId>(DEFAULT_PRESET);
  const [bubbleMotionId, setBubbleMotionId] = useState<BubbleMotionId>(DEFAULT_BUBBLE_MOTION);
  const visualConfig = useMemo(() => getVisualConfig(presetId), [presetId]);

  const [isImageZoomOpen, setIsImageZoomOpen] = useState(false);
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState('init');
  const [closeOnBackdrop, setCloseOnBackdrop] = useState(CLOSE_ON_BACKDROP_DEFAULT);
  const [showDrawerScrim, setShowDrawerScrim] = useState(DRAWER_MOTION.showScrimDefault);
  const [hitTestDebug, setHitTestDebug] = useState(false);
  const [hitTestSnapshot, setHitTestSnapshot] = useState<HitTestDebugSnapshot | null>(null);

  const pointerBlocked = isImageZoomOpen || isCategoryDrawerOpen;

  const overlayState: OverlayState = useMemo(() => {
    if (isImageZoomOpen) return 'image-zoom-open';
    if (isCategoryDrawerOpen) return 'drawer-open';
    return 'normal';
  }, [isImageZoomOpen, isCategoryDrawerOpen]);

  const getBubbleState = useCallback((): BubbleRuntimeState | null => {
    return controllerRef.current?.getBubbleState() ?? null;
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const key = e.key.toLowerCase();
      if (key === 'd' || key === 'g') {
        setUiMode((m) => (m === 'debug' ? 'review' : 'debug'));
      }
      if (key === 'r') setUiMode('review');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;

    const controller = new ExploreController({
      onStats(s, w) {
        if (cancelled) return;
        setStats(s);
        setWarnings(w);
      },
      onImageTap({ id, url }) {
        if (cancelled) return;
        setSelectedImageId(id);
        setSelectedImageUrl(url);
        setIsImageZoomOpen(true);
        setLastAction(`open IMAGE_ZOOM: ${id}`);
      },
      onReady() {
        if (cancelled) return;
        setReady(true);
        setLastAction('three ready');
      },
      onHitTestSnapshot(snapshot) {
        if (cancelled) return;
        setHitTestSnapshot(snapshot);
      },
    });

    controllerRef.current = controller;
    controller.init(host).catch((err) => {
      if (cancelled) return;
      console.error(err);
      setLastAction(`error: ${String(err)}`);
    });

    return () => {
      cancelled = true;
      setReady(false);
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const c = controllerRef.current;
    if (!c || !ready) return;
    c.setInteractionEnabled(!pointerBlocked);
    c.setOverlayOpen(isImageZoomOpen);
    c.setDrawerOpen(isCategoryDrawerOpen);
  }, [pointerBlocked, isImageZoomOpen, isCategoryDrawerOpen, ready]);

  useEffect(() => {
    if (!ready) return;
    controllerRef.current?.setPreset(presetId);
  }, [presetId, ready]);

  useEffect(() => {
    if (!ready) return;
    controllerRef.current?.setHitTestDebugEnabled(hitTestDebug && !reviewMode);
  }, [hitTestDebug, ready, reviewMode]);

  const closeZoom = useCallback(() => {
    setIsImageZoomOpen(false);
    setLastAction('close IMAGE_ZOOM');
  }, []);

  const closeDrawer = useCallback(() => {
    setIsCategoryDrawerOpen(false);
    setLastAction('close drawer');
  }, []);

  const selectCategory = useCallback((categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setLastAction(`select category: ${categoryId}`);
  }, []);

  return (
    <div className={`app${reviewMode ? ' review-mode' : ' debug-mode'}`}>
      <div className="three-layer" ref={hostRef} />
      <div
        className="bg-gradient"
        style={{
          background: `radial-gradient(ellipse 120% 80% at 50% 40%, ${visualConfig.background.gradientTop} 0%, ${visualConfig.background.color} 55%, ${visualConfig.background.gradientBottom} 100%)`,
          opacity: visualConfig.background.gradientOpacity,
        }}
        aria-hidden="true"
      />
      <NoiseOverlay config={visualConfig} />
      <div className="bg-vignette" aria-hidden="true" />

      {/* Review Mode でも Bubble UI + カラー復帰は表示 */}
      <BubbleOverlay getState={getBubbleState} motionId={bubbleMotionId} />

      <HitTestDebugOverlay enabled={hitTestDebug && !reviewMode} snapshot={hitTestSnapshot} />

      <div className="ui-chrome-layer">
        {!reviewMode && <DemoBanner />}
        {!ready && <div className="loading-badge">loading…</div>}
        {!reviewMode && warnings.length > 0 && (
          <div className="error-badge">{warnings[0]}</div>
        )}

        <button
          type="button"
          className="hamburger"
          aria-label={isCategoryDrawerOpen ? 'Close menu' : 'Open menu'}
          onClick={() => {
            setIsCategoryDrawerOpen((o) => !o);
            setLastAction(isCategoryDrawerOpen ? 'close drawer' : 'open drawer');
          }}
        >
          {isCategoryDrawerOpen ? (
            <span className="hamburger-close-mark" aria-hidden="true">
              ×
            </span>
          ) : (
            <>
              <span className="hamburger-bar" />
              <span className="hamburger-bar" />
              <span className="hamburger-bar" />
            </>
          )}
        </button>

        {!reviewMode && (
          <DebugPanel
            stats={stats}
            warnings={warnings}
            lastAction={lastAction}
            overlayState={overlayState}
            bubbleMotionId={bubbleMotionId}
          />
        )}

        {!reviewMode && (
          <DemoToggles
            presetId={presetId}
            onPresetChange={(id) => {
              setPresetId(id);
              setLastAction(`visual preset: ${id}`);
            }}
            bubbleMotionId={bubbleMotionId}
            onBubbleMotionChange={(id) => {
              setBubbleMotionId(id);
              setLastAction(`bubble motion: ${id}`);
            }}
            hitTestDebug={hitTestDebug}
            onHitTestDebugChange={setHitTestDebug}
            closeOnBackdrop={closeOnBackdrop}
            onCloseOnBackdropChange={setCloseOnBackdrop}
            showDrawerScrim={showDrawerScrim}
            onDrawerScrimChange={setShowDrawerScrim}
            uiMode={uiMode}
            onUiModeChange={setUiMode}
          />
        )}
      </div>

      <ImageZoomOverlay
        open={isImageZoomOpen}
        imageId={selectedImageId}
        imageUrl={selectedImageUrl}
        closeOnBackdrop={closeOnBackdrop}
        onClose={closeZoom}
        reviewMode={reviewMode}
      />

      <CategoryDrawer
        open={isCategoryDrawerOpen}
        selectedCategoryId={selectedCategoryId}
        showScrim={showDrawerScrim}
        onClose={closeDrawer}
        onSelectCategory={selectCategory}
      />
    </div>
  );
}
