import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExploreController } from './pixi/exploreController';
import type { DebugStats } from './pixi/types';
import {
  CLOSE_ON_BACKDROP_DEFAULT,
  DRAWER_MOTION,
  type OverlayState,
} from './motionConfig';
import { DEFAULT_PRESET, DEFAULT_TONE_PRESET, getVisualConfig, TONE_PRESET_IDS, TONE_PRESETS, type TonePresetId, type VisualPresetId } from './visualConfig';
import { CategoryDrawer } from './ui/CategoryDrawer';
import { DebugPanel } from './ui/DebugPanel';
import { DemoBanner } from './ui/DemoBanner';
import { HitTestDebugOverlay } from './ui/HitTestDebugOverlay';
import { ImageZoomOverlay } from './ui/ImageZoomOverlay';
import { NoiseOverlay, VisualToggles } from './ui/NoiseOverlay';
import type { HitTestDebugSnapshot } from './pixi/hitTestDiagnostics';
import {
  DEFAULT_UI_MODE,
  isDebugMode,
  type UiDisplayMode,
} from './uiMode';

export function App() {
  const pixiHostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<ExploreController | null>(null);

  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState<DebugStats | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [presetId, setPresetId] = useState<VisualPresetId>(DEFAULT_PRESET);
  const [tonePresetId, setTonePresetId] = useState<TonePresetId>(DEFAULT_TONE_PRESET);
  const visualConfig = useMemo(
    () => getVisualConfig(presetId, tonePresetId),
    [presetId, tonePresetId],
  );

  const [uiMode, setUiMode] = useState<UiDisplayMode>(DEFAULT_UI_MODE);
  const reviewMode = !isDebugMode(uiMode);

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
  const [debugCanvas, setDebugCanvas] = useState<HTMLCanvasElement | null>(null);

  const pointerBlocked = isImageZoomOpen || isCategoryDrawerOpen;

  const overlayState: OverlayState = useMemo(() => {
    if (isImageZoomOpen) return 'image-zoom-open';
    if (isCategoryDrawerOpen) return 'drawer-open';
    return 'normal';
  }, [isImageZoomOpen, isCategoryDrawerOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const key = e.key.toLowerCase();
      if (key === 'd' || key === 'g') {
        setUiMode((m) => (m === 'debug' ? 'review' : 'debug'));
      }
      if (key === 'r') {
        setUiMode('review');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const host = pixiHostRef.current;
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
        setDebugCanvas(controller.getCanvas());
        setLastAction('pixi ready');
      },
      onHitTestSnapshot(snapshot) {
        if (cancelled) return;
        setHitTestSnapshot(snapshot);
      },
    });

    controllerRef.current = controller;
    controller.init(host, DEFAULT_PRESET, DEFAULT_TONE_PRESET).catch((err) => {
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
    if (!ready) return;
    controllerRef.current?.setPreset(presetId);
    setLastAction(`preset: ${presetId}`);
  }, [presetId, ready]);

  useEffect(() => {
    if (!ready) return;
    controllerRef.current?.setTonePreset(tonePresetId);
    setLastAction(`tone: ${tonePresetId}`);
  }, [tonePresetId, ready]);

  useEffect(() => {
    if (!ready) return;
    controllerRef.current?.setHitTestDebugEnabled(hitTestDebug && !reviewMode);
  }, [hitTestDebug, ready, reviewMode]);

  useEffect(() => {
    if (!ready) return;
    controllerRef.current?.setUiState(overlayState, isCategoryDrawerOpen, pointerBlocked);
  }, [overlayState, isCategoryDrawerOpen, pointerBlocked, ready]);

  const openDrawer = useCallback(() => {
    if (isImageZoomOpen) return;
    setIsCategoryDrawerOpen(true);
    setLastAction('open categoryDrawer');
  }, [isImageZoomOpen]);

  const closeDrawer = useCallback(() => {
    setIsCategoryDrawerOpen(false);
    setLastAction('close categoryDrawer');
  }, []);

  const closeZoom = useCallback(() => {
    setIsImageZoomOpen(false);
    controllerRef.current?.onZoomClosed();
    setLastAction('close IMAGE_ZOOM');
  }, []);

  const selectCategory = useCallback((categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setLastAction(`select category: ${categoryId}`);
  }, []);

  return (
    <div
      className={`app${reviewMode ? ' review-mode' : ' debug-mode'}`}
      data-demo="dd-pixi-three-style"
      data-ui-mode={uiMode}
    >
      <div
        className={`pixi-layer${pointerBlocked ? ' blocked' : ''}`}
        ref={pixiHostRef}
        aria-hidden={pointerBlocked}
      />

      <NoiseOverlay config={visualConfig} />

      <div
        className="bg-gradient"
        style={{
          background: `radial-gradient(ellipse 120% 80% at 50% 40%, ${visualConfig.background.gradientTop} 0%, ${visualConfig.background.color} 55%, ${visualConfig.background.gradientBottom} 100%)`,
          opacity: visualConfig.background.gradientOpacity,
        }}
        aria-hidden="true"
      />

      <HitTestDebugOverlay
        enabled={hitTestDebug && !reviewMode}
        canvas={debugCanvas}
        snapshot={hitTestSnapshot}
      />

      <div className="ui-chrome-layer">
        {!reviewMode && <DemoBanner />}

        {!ready && lastAction.startsWith('error:') && (
          <div className="error-badge">{lastAction}</div>
        )}
        {!ready && !lastAction.startsWith('error:') && !reviewMode && (
          <div className="loading-badge">Loading…</div>
        )}

        <button
          type="button"
          className={`hamburger${isCategoryDrawerOpen ? ' is-close' : ''}`}
          aria-label={isCategoryDrawerOpen ? 'Close category menu' : 'Open category menu'}
          aria-expanded={isCategoryDrawerOpen}
          onPointerUp={(e) => {
            e.stopPropagation();
            if (isCategoryDrawerOpen) {
              closeDrawer();
            } else {
              openDrawer();
            }
          }}
          disabled={isImageZoomOpen}
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
          <DebugPanel stats={stats} warnings={warnings} lastAction={lastAction} />
        )}

        {!reviewMode && (
          <VisualToggles
            presetId={presetId}
            onPresetChange={setPresetId}
            tonePresetId={tonePresetId}
            onTonePresetChange={setTonePresetId}
            closeOnBackdrop={closeOnBackdrop}
            onCloseOnBackdropChange={setCloseOnBackdrop}
            showDrawerScrim={showDrawerScrim}
            onDrawerScrimChange={setShowDrawerScrim}
            hitTestDebug={hitTestDebug}
            onHitTestDebugChange={setHitTestDebug}
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
