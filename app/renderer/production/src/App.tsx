import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CategoryGalleryPayload,
  ContentImageValidationSummary,
  LogoAssetInfo,
  NoiseAssetInfo,
  ProductionAction,
  ProductionCategory,
  ProductionSnapshot,
  SharedCopyInfo,
} from './productionApi';
import { ExploreHost } from './three/ExploreHost';
import type { ExploreViewLayout } from './three/exploreController';
import type { ImageZoomLoadStatus, ListDebugStats, SelectedDemoCard } from './types';
import { CategoryDrawer } from './ui/CategoryDrawer';
import { HamburgerButton } from './ui/HamburgerButton';
import { ImageZoomOverlay } from './overlays/ImageZoomOverlay';
import { CategoryModal } from './overlays/CategoryModal';
import { NoiseOverlay, noiseDebugLine } from './ui/NoiseOverlay';
import { listConfig } from './listConfig';
import { resolveImageCopy } from './imageCopy';
import { matchDollyFeel, runtimeConfig } from './runtimeConfig';
import { CARD_MOTION } from './three/sceneLayout';
import { IMAGE_ZOOM_MOTION } from './imageZoomMotion';
import { CATEGORY_MODAL_MOTION, SQUARE_LOGO_RELATIVE_PATH } from './categoryModalMotion';
import { loadMaisonNeue, type BrandFontStatus } from './loadBrandFonts';
import { isDebugMode, type UiDisplayMode } from './uiMode';
import type { ContentLoadStatus } from './types';

const sceneCopy = {
  AD_IDLE: {
    kicker: 'AD_IDLE',
    title: '4-screen synced ad content',
    copy: 'One advertisement wall on a shared clock. Tap this stage (not the debug panel) to start ANIMATION on all four monitors.',
  },
  ANIMATION: {
    kicker: 'ANIMATION',
    title: '4-screen synchronized ANIMATION',
    copy: 'Stage touch is ignored. The mp4 plays to the end. LIST preload in the background does not skip it.',
  },
  PRODUCT_LIST: {
    kicker: 'PRODUCT_LIST',
    title: 'PRODUCT_LIST',
    copy: 'Independent clone world on this monitor. Overlay (ZOOM / Drawer / modal) is local to this window.',
  },
} as const;

function formatIdle(idle: ProductionSnapshot['idle'] | undefined): string {
  if (!idle) return 'idle: —';
  if (!idle.armed || idle.lastValidTouchAtMs == null) {
    return `idle: off (${idle.timeoutSeconds}s ${idle.source})`;
  }
  const leftMs = idle.timeoutSeconds * 1000 - (Date.now() - idle.lastValidTouchAtMs);
  return `idle: ${Math.max(0, leftMs / 1000).toFixed(1)}s / ${idle.timeoutSeconds}s`;
}

function isDebugPanelEvent(event: Event): boolean {
  const target = event.target;
  return Boolean(target instanceof Element && target.closest('.debug-panel, .debug-toggle, .topbar'));
}

type ListPreloadStatus = 'idle' | 'loading' | 'ready' | 'failed';

function listPreloadStatus(scene: ProductionSnapshot['globalScene'], load: ContentLoadStatus | undefined): ListPreloadStatus {
  if (scene === 'AD_IDLE') return 'idle';
  if (!load || load === 'idle' || load === 'loading') return 'loading';
  if (load === 'loaded') return 'ready';
  return 'failed';
}

export function App() {
  const [snapshot, setSnapshot] = useState<ProductionSnapshot | null>(null);
  const [error, setError] = useState('');
  const [listStats, setListStats] = useState<ListDebugStats | null>(null);
  const [contentValidation, setContentValidation] = useState<ContentImageValidationSummary | null>(null);
  const [tappedCard, setTappedCard] = useState<SelectedDemoCard | null>(null);
  const [imageZoomLoadStatus, setImageZoomLoadStatus] = useState<ImageZoomLoadStatus>('idle');
  const [categories, setCategories] = useState<ProductionCategory[]>([]);
  const [logo, setLogo] = useState<LogoAssetInfo | null>(null);
  const [noiseAsset, setNoiseAsset] = useState<NoiseAssetInfo | null>(null);
  const [gallery, setGallery] = useState<CategoryGalleryPayload | null>(null);
  const [modalIndex, setModalIndex] = useState(0);
  const [idleLabel, setIdleLabel] = useState('idle: —');
  const [preloadStartedAtMs, setPreloadStartedAtMs] = useState<number | null>(null);
  const [preloadDurationMs, setPreloadDurationMs] = useState<number | null>(null);
  const [debugVisible, setDebugVisible] = useState(false);
  const [uiMode, setUiMode] = useState<UiDisplayMode>('review');
  const [preloadReadyBeforeListEnter, setPreloadReadyBeforeListEnter] = useState<boolean | null>(null);
  const [brandFont, setBrandFont] = useState<BrandFontStatus | null>(null);
  const [sharedCopy, setSharedCopy] = useState<SharedCopyInfo | null>(null);
  const debugInitRef = useRef(false);
  const snapshotRef = useRef<ProductionSnapshot | null>(null);
  snapshotRef.current = snapshot;
  const categoriesRef = useRef<ProductionCategory[]>([]);
  categoriesRef.current = categories;
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastVideoKeyRef = useRef('');

  const lastActivityAtRef = useRef(0);

  const dispatch = useCallback(async (action: ProductionAction) => {
    setError('');
    try {
      const next = await window.trunkApi.dispatchProduction(action);
      snapshotRef.current = next;
      setSnapshot(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const reportActivity = useCallback(() => {
    const current = snapshotRef.current;
    if (!current || current.globalScene !== 'PRODUCT_LIST') return;
    lastActivityAtRef.current = Date.now();
    void dispatch({ type: 'REPORT_TOUCH_ACTIVITY' });
  }, [dispatch]);

  useEffect(() => {
    if (!window.trunkApi?.getProductionSnapshot) {
      setError('production API is not available (wrong shell?)');
      return;
    }
    let unsub: (() => void) | undefined;
    void window.trunkApi.getProductionSnapshot().then((next) => {
      snapshotRef.current = next;
      setSnapshot(next);
    });
    if (window.trunkApi.getContentImageValidation) {
      void window.trunkApi.getContentImageValidation().then(setContentValidation);
    }
    if (window.trunkApi.getCategories) {
      void window.trunkApi.getCategories().then((rows) => {
        setCategories([...rows].sort((a, b) => a.order - b.order));
      });
    }
    if (window.trunkApi.getLogoAsset) {
      void window.trunkApi.getLogoAsset().then(setLogo);
    }
    if (window.trunkApi.getNoiseAsset) {
      void window.trunkApi.getNoiseAsset().then(setNoiseAsset);
    }
    if (window.trunkApi.getSharedCopy) {
      void window.trunkApi.getSharedCopy().then(setSharedCopy);
    }
    void loadMaisonNeue().then((status) => {
      setBrandFont(status);
      window.__productionDebug = {
        ...window.__productionDebug,
        fontFamily: status.family,
        fontLoaded: status.fontLoaded,
        fontFallback: status.fontFallback,
        fontFormat: status.format,
        fontCheck: status.fontCheck,
      };
    });
    unsub = window.trunkApi.onProductionStateChanged((next) => {
      snapshotRef.current = next;
      setSnapshot(next);
    });
    return () => unsub?.();
  }, []);

  useEffect(() => {
    if (!snapshot || debugInitRef.current) return;
    debugInitRef.current = true;
    setUiMode('review');
    setDebugVisible(false);
  }, [snapshot]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const current = snapshotRef.current;
      if (!current) return;
      if (current.globalScene === 'ANIMATION') {
        if (!isDebugPanelEvent(event)) {
          event.preventDefault();
          void window.trunkApi.logEvent({
            level: 'info',
            message: 'animation touch ignored',
            context: { monitorId: current.monitorId },
          });
        }
        return;
      }
      if (isDebugPanelEvent(event)) {
        if (current.globalScene === 'PRODUCT_LIST') reportActivity();
        return;
      }
      if (current.globalScene === 'AD_IDLE') {
        void window.trunkApi.logEvent({
          level: 'info',
          message: 'AD_IDLE touch → ANIMATION',
          context: { monitorId: current.monitorId },
        });
        void dispatch({ type: 'AD_IDLE_TOUCH' });
        return;
      }
      if (current.globalScene === 'PRODUCT_LIST') {
        reportActivity();
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      const current = snapshotRef.current;
      if (!current || current.globalScene !== 'PRODUCT_LIST') return;
      if (current.own.localOverlay === 'NONE') return;
      if (event.buttons === 0 && event.pointerType !== 'touch') return;
      if (Date.now() - lastActivityAtRef.current < 400) return;
      reportActivity();
    };
    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    window.addEventListener('pointermove', onPointerMove, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointermove', onPointerMove, true);
    };
  }, [dispatch, reportActivity]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const key = event.key.toLowerCase();
      if (key === 'd' || key === 'g') {
        setUiMode((mode) => (mode === 'debug' ? 'review' : 'debug'));
        return;
      }
      if (key === 'r') {
        setUiMode('review');
        setDebugVisible(false);
        return;
      }
      if (key === 'p') {
        setDebugVisible((value) => !value);
        return;
      }
      if (key === '1') void dispatch({ type: 'SET_GLOBAL_SCENE', scene: 'AD_IDLE' });
      if (key === '2') void dispatch({ type: 'SET_GLOBAL_SCENE', scene: 'ANIMATION' });
      if (key === '3') void dispatch({ type: 'SET_GLOBAL_SCENE', scene: 'PRODUCT_LIST' });
      if (key === 'z') void dispatch({ type: 'OPEN_IMAGE_ZOOM', imageId: snapshotRef.current?.own.selectedImageId ?? undefined });
      if (key === 'h') void dispatch({ type: 'OPEN_CATEGORY_DRAWER' });
      if (key === 'c') {
        const categoryId = snapshotRef.current?.own.selectedCategoryId ?? categoriesRef.current[0]?.id;
        if (categoryId) void dispatch({ type: 'OPEN_CATEGORY_MODAL', categoryId });
      }
      if (key === 'x' || key === 'escape') void dispatch({ type: 'CLOSE_OVERLAY' });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch]);

  useEffect(() => {
    const id = window.setInterval(() => setIdleLabel(formatIdle(snapshotRef.current?.idle)), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (snapshot?.globalScene === 'AD_IDLE') {
      setListStats(null);
      setTappedCard(null);
      setImageZoomLoadStatus('idle');
      setGallery(null);
      setModalIndex(0);
      setPreloadStartedAtMs(null);
      setPreloadDurationMs(null);
      setPreloadReadyBeforeListEnter(null);
    }
  }, [snapshot?.globalScene]);

  useEffect(() => {
    const scene = snapshot?.globalScene;
    if (scene !== 'ANIMATION' && scene !== 'PRODUCT_LIST') return;
    setPreloadStartedAtMs((prev) => prev ?? Date.now());
  }, [snapshot?.globalScene]);

  useEffect(() => {
    if (preloadStartedAtMs == null || !snapshot) return;
    const status = listPreloadStatus(snapshot.globalScene, listStats?.contentLoadStatus);
    if (status === 'ready' || status === 'failed') {
      setPreloadDurationMs((prev) => prev ?? Date.now() - preloadStartedAtMs);
    }
  }, [listStats?.contentLoadStatus, preloadStartedAtMs, snapshot]);

  useEffect(() => {
    if (snapshot?.globalScene !== 'PRODUCT_LIST') return;
    setPreloadReadyBeforeListEnter((prev) => {
      if (prev != null) return prev;
      return listStats?.contentLoadStatus === 'loaded';
    });
  }, [snapshot?.globalScene, listStats?.contentLoadStatus]);

  useEffect(() => {
    if (snapshot?.own.localOverlay === 'NONE') {
      setTappedCard(null);
      setImageZoomLoadStatus('idle');
      setGallery(null);
      setModalIndex(0);
    }
  }, [snapshot?.own.localOverlay]);

  useEffect(() => {
    const overlay = snapshot?.own.localOverlay;
    const categoryId = snapshot?.own.selectedCategoryId;
    if (overlay !== 'CATEGORY_MODAL' || !categoryId || !window.trunkApi.getCategoryGallery) {
      return;
    }
    let cancelled = false;
    setGallery((prev) => (prev?.category.id === categoryId ? prev : null));
    void window.trunkApi
      .getCategoryGallery(categoryId)
      .then((next) => {
        if (cancelled) return;
        setGallery(next);
        setModalIndex(0);
      })
      .catch((err) => {
        if (cancelled) return;
        setGallery(null);
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [snapshot?.own.localOverlay, snapshot?.own.selectedCategoryId]);

  useEffect(() => {
    const el = videoRef.current;
    const video = snapshot?.video;
    if (!el || !video) return;
    const show = snapshot.globalScene !== 'PRODUCT_LIST' && video.scene !== 'none' && video.track.found && video.track.url;
    const onEnded = () => {
      const current = snapshotRef.current;
      if (current?.globalScene !== 'ANIMATION') return;
      void dispatch({ type: 'ANIMATION_COMPLETE' });
    };
    el.addEventListener('ended', onEnded);
    if (!show) {
      el.hidden = true;
      el.removeAttribute('src');
      el.pause();
      lastVideoKeyRef.current = '';
      return () => el.removeEventListener('ended', onEnded);
    }
    el.hidden = false;
    const key = `${video.sessionId}:${video.track.url}`;
    if (key === lastVideoKeyRef.current) {
      return () => el.removeEventListener('ended', onEnded);
    }
    lastVideoKeyRef.current = key;
    el.loop = Boolean(video.loop);
    el.muted = true;
    el.src = video.track.url!;
    const elapsedMs = Math.max(0, Date.now() - video.startedAtMs);
    let seek = elapsedMs / 1000;
    if (video.loop && video.durationMs > 0) seek = (elapsedMs % video.durationMs) / 1000;
    const applyClock = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) {
        el.currentTime = Math.min(seek, Math.max(0, el.duration - 0.05));
      }
      void el.play().catch(() => {});
    };
    el.addEventListener('loadedmetadata', applyClock, { once: true });
    el.load();
    return () => el.removeEventListener('ended', onEnded);
  }, [dispatch, snapshot]);

  const exploreLayout: ExploreViewLayout | null = useMemo(() => {
    if (!snapshot) return null;
    return {
      monitorId: snapshot.monitorId,
      viewportOffsetX: snapshot.layout.viewportOffsetX,
      viewportOffsetY: snapshot.layout.viewportOffsetY,
      scale: snapshot.layout.scale,
      orientation: snapshot.layout.orientation,
      width: snapshot.layout.width,
      height: snapshot.layout.height,
    };
  }, [
    snapshot?.monitorId,
    snapshot?.layout.viewportOffsetX,
    snapshot?.layout.viewportOffsetY,
    snapshot?.layout.scale,
    snapshot?.layout.orientation,
    snapshot?.layout.width,
    snapshot?.layout.height,
  ]);

  const handleCardTap = useCallback(
    (card: SelectedDemoCard) => {
      setTappedCard(card);
      setImageZoomLoadStatus(card.imageUrl ? 'loading' : 'error');
      void dispatch({ type: 'OPEN_IMAGE_ZOOM', imageId: card.sourceImageId || card.instanceId });
    },
    [dispatch],
  );

  if (!snapshot) {
    return (
      <div className="app scene-AD_IDLE review-mode">
        <p className="boot-copy">{error || ''}</p>
      </div>
    );
  }

  const { globalScene, adMode, monitorId, own, monitors, layout, video, idle, debug } = snapshot;
  const scene = sceneCopy[globalScene];
  const overlayOn = own.localOverlay !== 'NONE';
  const listActive = globalScene === 'PRODUCT_LIST';
  const listMounted = (globalScene === 'ANIMATION' || globalScene === 'PRODUCT_LIST') && Boolean(exploreLayout);
  const missingVideo = Boolean(video.scene !== 'none' && video.track && !video.track.found);
  const adVideoLive =
    globalScene === 'AD_IDLE' && Boolean(video.track.found && video.track.url);
  const interactionEnabled = listActive && !own.interactionLocked;
  const drawerOpen = listActive && own.localOverlay === 'CATEGORY_DRAWER';
  const zoomOpen = listActive && own.localOverlay === 'IMAGE_ZOOM';
  const modalOpen = listActive && own.localOverlay === 'CATEGORY_MODAL';
  const preload = listPreloadStatus(globalScene, listStats?.contentLoadStatus);
  const listVisualReady = listActive && (preload === 'ready' || preload === 'failed');
  const hamburgerVisible = listVisualReady && own.localOverlay === 'NONE';
  const livePreloadMs =
    preloadDurationMs ?? (preloadStartedAtMs != null ? Date.now() - preloadStartedAtMs : null);
  const reviewMode = !isDebugMode(uiMode);
  const chromeVisible = !reviewMode;
  const noiseApply =
    listVisualReady &&
    listConfig.noiseEnabled &&
    ((own.localOverlay === 'NONE' && listConfig.noiseApplyToList) ||
      (own.localOverlay === 'IMAGE_ZOOM' && listConfig.noiseApplyToImageZoom) ||
      (own.localOverlay === 'CATEGORY_MODAL' && listConfig.noiseApplyToCategoryModal) ||
      (own.localOverlay === 'CATEGORY_DRAWER' && listConfig.noiseApplyToList));
  const selectedCategory = categories.find((row) => row.id === own.selectedCategoryId) ?? null;
  const modalCategory =
    own.localOverlay === 'CATEGORY_MODAL'
      ? selectedCategory ?? gallery?.category ?? null
      : selectedCategory;
  const firstCategoryId = categories[0]?.id;
  const modalSlides = (gallery?.images ?? []).map((img) => ({
    id: img.id,
    url: img.url,
    title: img.title,
    description: img.description,
    kind: img.kind ?? 'content',
    courseName: img.courseName ?? null,
  }));
  const zoomCopy = resolveImageCopy({
    sharedTitle: sharedCopy?.found ? sharedCopy.title : null,
    sharedDescription: sharedCopy?.found ? sharedCopy.description : null,
    sourceImageId: tappedCard?.sourceImageId ?? own.selectedImageId,
    cardTitle: tappedCard?.title,
  });
  const dollyFeel = matchDollyFeel(
    runtimeConfig.cameraDollySpeed,
    runtimeConfig.dollyPoseSmoothing,
    runtimeConfig.pinchDollyScale,
  );

  return (
    <div className={`app scene-${globalScene} overlay-${own.localOverlay}${reviewMode ? ' review-mode' : ' debug-mode'}`}>
      {chromeVisible ? (
      <header className="topbar">
        <span className="badge">monitor {monitorId}</span>
        <span className="badge">globalScene: {globalScene}</span>
        <span className="badge">adMode: {adMode}</span>
        <span className="badge">uiMode: {uiMode}</span>
        <span className="badge">{idleLabel}</span>
        {listStats ? <span className="badge">fps {listStats.fps.toFixed(0)}</span> : null}
        <span className="badge" hidden={!debug.isDevFallback}>
          DEV FALLBACK
        </span>
        <span className="badge" hidden={!debug.isPreviewMode}>
          PREVIEW {debug.previewWindows ?? debug.previewMode} {debug.previewMode} ×{debug.previewScale?.toFixed(2) ?? '—'}
        </span>
        <span className="badge badge--warn" hidden={!debug.boundsMismatch}>
          BOUNDS MISMATCH
        </span>
        <button
          type="button"
          className="debug-toggle"
          aria-pressed={debugVisible}
          onClick={() => setDebugVisible((value) => !value)}
        >
          {debugVisible ? 'Hide debug' : 'Show debug'}
        </button>
      </header>
      ) : null}

      <video ref={videoRef} className="scene-video" hidden playsInline muted />

      {listMounted && exploreLayout ? (
        <div className={`list-stage${listVisualReady ? '' : ' is-preload'}`}>
          <ExploreHost
            layout={exploreLayout}
            onStats={setListStats}
            onCardTap={handleCardTap}
            onContentSettled={() => undefined}
            onValidActivity={reportActivity}
            interactionEnabled={interactionEnabled}
            overlayOpen={overlayOn}
            imageZoomLoadStatus={imageZoomLoadStatus}
          />
          <NoiseOverlay apply={noiseApply} />
          {hamburgerVisible ? (
            <HamburgerButton
              mode="bars"
              onClick={() => void dispatch({ type: 'OPEN_CATEGORY_DRAWER' })}
            />
          ) : null}
          <CategoryDrawer
            open={drawerOpen}
            categories={categories}
            selectedCategoryId={own.selectedCategoryId}
            onClose={() => void dispatch({ type: 'CLOSE_OVERLAY' })}
            onSelectCategory={(categoryId) => void dispatch({ type: 'OPEN_CATEGORY_MODAL', categoryId })}
          />
          <ImageZoomOverlay
            open={zoomOpen}
            card={tappedCard}
            copy={zoomCopy}
            logoUrl={logo?.url ?? null}
            logoFound={Boolean(logo?.found)}
            onClose={() => void dispatch({ type: 'CLOSE_OVERLAY' })}
            onLoadStatus={setImageZoomLoadStatus}
          />
          <CategoryModal
            open={modalOpen}
            categoryLabel={modalCategory?.label || own.selectedCategoryId || 'Category'}
            categoryTitle={sharedCopy?.found ? sharedCopy.title : modalCategory?.title}
            categoryDescription={sharedCopy?.found ? sharedCopy.description : modalCategory?.description}
            slides={modalSlides}
            onClose={() => void dispatch({ type: 'CLOSE_OVERLAY' })}
            onIndexChange={setModalIndex}
          />
          {!listVisualReady && globalScene !== 'PRODUCT_LIST' ? (
            <main className="scene-stage">
              <p className="kicker">{scene.kicker}</p>
              <h1 className="scene-title">{scene.title}</h1>
              <p className="scene-copy">
                {missingVideo
                  ? `${scene.copy} Missing ${video.track.relativePath} — placeholder until files are placed.`
                  : scene.copy}
              </p>
              <p className="monitor-line">monitorId: {monitorId}</p>
            </main>
          ) : null}
        </div>
      ) : adVideoLive ? (
        <button type="button" className="ad-hit" aria-label="広告をタッチして ANIMATION を開始" />
      ) : (
        <main className="scene-stage">
          <p className="kicker">{scene.kicker}</p>
          <h1 className="scene-title">{scene.title}</h1>
          <p className="scene-copy">
            {missingVideo
              ? `${scene.copy} Missing ${video.track.relativePath} — 現地の content/ads/ に mp4 を置いてください。`
              : scene.copy}
          </p>
          <p className="monitor-line">monitorId: {monitorId}</p>
        </main>
      )}

      <section className="debug-panel" aria-label="Phase 5.7 debug" hidden={!chromeVisible || !debugVisible}>
        <h2>Phase 5.14 debug — this monitor</h2>
        <pre className="debug-pre">
          {[
            `monitorId: ${monitorId}`,
            `globalScene: ${globalScene}`,
            `localOverlay: ${own.localOverlay}`,
            `interactionLocked: ${own.interactionLocked}`,
            `selectedImageId: ${own.selectedImageId ?? 'null'}`,
            `selectedCategoryId: ${own.selectedCategoryId ?? 'null'}`,
            `modalIndex: ${modalOpen ? modalIndex : '—'}  galleryImages: ${gallery?.images.length ?? 0}  covers: ${gallery?.images.filter((img) => img.kind === 'cover').length ?? 0}`,
            `sharedCopy: ${sharedCopy?.found ? sharedCopy.relativePath : sharedCopy?.warning ?? 'loading…'}`,
            `logo: ${logo?.found ? logo.fileName : 'missing'}  scheme=${logo?.url ? logo.url.split(':')[0] : 'none'}`,
            noiseDebugLine(noiseAsset),
            `listPreloadStatus: ${preload}`,
            `preloadReadyBeforeListEnter: ${preloadReadyBeforeListEnter ?? '—'}`,
            `preloadStartedAt: ${preloadStartedAtMs ?? '—'}  preloadDurationMs: ${livePreloadMs ?? '—'}`,
            `textureLoaded: ${listStats?.textureLoadedCount ?? 0}  failed: ${listStats?.textureFailedCount ?? 0}`,
            `uiMode: ${uiMode}  chromeVisible: ${chromeVisible}`,
            `startupScene: ${debug.isPreviewMode && debug.previewWindows === 'single' ? 'preview-single skip → PRODUCT_LIST (keys 1=AD_IDLE 2=ANIMATION 3=LIST)' : 'AD_IDLE (touch → ANIMATION → LIST)'}`,
            `visualPreset: ${runtimeConfig.visualPresetId}  bubbleMotion: ${runtimeConfig.bubbleMotionId}  pixelRatioCap: ${runtimeConfig.rendererPixelRatioMax}`,
            `bubbleSize: ${runtimeConfig.bubbleSizePx}  revealRadius: ${runtimeConfig.revealRadiusPx}  listSpeed: ${runtimeConfig.listMotionSpeed}`,
            `dollyCruise: ${runtimeConfig.dollyCruiseEnabled}  dollyFeel: ${dollyFeel}  dollySpeed: ${runtimeConfig.cameraDollySpeed}  dollySmoothing: ${runtimeConfig.dollyPoseSmoothing}  pinch: ${runtimeConfig.pinchDollyScale}`,
            `nearFadeStart: ${CARD_MOTION.nearFadeStartDist}  nearFadeEnd: ${CARD_MOTION.nearFadeEndDist}  nearScaleStartUsed: ${CARD_MOTION.nearScaleEnabled}  nearScaleMinUsed: ${CARD_MOTION.nearScaleEnabled}  maxScaleClamp: ${CARD_MOTION.maxScaleClamp}  maxApparentDist: ${CARD_MOTION.maxApparentScaleDist}  fadeAlpha: ${listStats?.nearFadeAlpha?.toFixed(2) ?? '—'}`,
            `imageZoomMotion: open ${IMAGE_ZOOM_MOTION.durationMs}ms close ${IMAGE_ZOOM_MOTION.closeMs}ms scrim ${IMAGE_ZOOM_MOTION.scrimMs}ms ${IMAGE_ZOOM_MOTION.easingCss}`,
            `categoryModalMotion: open ${CATEGORY_MODAL_MOTION.durationMs}ms close ${CATEGORY_MODAL_MOTION.closeMs}ms scrim ${CATEGORY_MODAL_MOTION.scrimMs}ms ${CATEGORY_MODAL_MOTION.easingCss} logo=${SQUARE_LOGO_RELATIVE_PATH}`,
            `fontFamily: ${brandFont?.family ?? 'Maison Neue'}  fontLoaded: ${brandFont?.fontLoaded ?? '—'}  fontFallback: ${brandFont?.fontFallback ?? '—'}  fontFormat: ${brandFont?.format ?? 'otf'}  fontCheck: ${brandFont?.fontCheck ?? '—'}`,
            `fontFaces: ${brandFont?.faces.length ? brandFont.faces.join(', ') : 'none'}  skipped: ${brandFont?.skipped.length ? brandFont.skipped.join(', ') : '—'}`,
            `densityPreset: ${listConfig.densityPreset}  targetCardCount: ${listConfig.targetCardCount}  displayed: ${listStats?.displayedImageCount ?? '—'}  spread ${listStats?.sceneSpreadX ?? '—'}x${listStats?.sceneSpreadY ?? '—'}x${listStats?.sceneSpreadZ ?? '—'}`,
            `listImageCount: ${contentValidation?.listDirImageCount ?? listStats?.realImageCount ?? '—'}  listSourceMode: ${listStats?.exploreSource ?? contentValidation?.exploreSource ?? '—'}`,
            `categoryFoodFolderCount: ${contentValidation?.foodFolderCount ?? '—'}  categoryFoodSlideCount: ${modalOpen && gallery ? gallery.images.length : contentValidation?.categoryFoodSlideCount ?? '—'}`,
            `coverImageCount: ${contentValidation?.coverImageCount ?? '—'}  foodFolders: ${(contentValidation?.foodFolderNames ?? []).join(',') || '—'}`,
            `textLoaded: ${contentValidation?.textLoaded ?? sharedCopy?.found ?? '—'}  textSource: ${contentValidation?.textSource ?? sharedCopy?.relativePath ?? '—'}`,
            `adsVideoMode: ${contentValidation?.adsVideoMode ?? '—'}  adsVideoFiles: ${(contentValidation?.adsVideoFiles ?? []).join(', ') || (globalScene === 'AD_IDLE' && video.track.found ? video.track.relativePath : '—')}`,
            `animationVideoMode: ${contentValidation?.animationVideoMode ?? '—'}  animationVideoFiles: ${(contentValidation?.animationVideoFiles ?? []).join(', ') || (video.track.found ? video.track.relativePath : 'missing')}`,
            `fontsDir: ${contentValidation?.fontsDirExists ?? '—'}  fontFileCount: ${contentValidation?.fontFileCount ?? '—'}`,
            `noiseOpacity: ${listConfig.noiseOpacity}  logo: ${logo?.fileName ?? 'missing'}`,
            `isDevFallback: ${debug.isDevFallback}  isPreviewMode: ${Boolean(debug.isPreviewMode)}`,
            `preview: ${debug.isPreviewMode ? `${debug.previewWindows ?? 'multi'} ${debug.previewMode} scale=${debug.previewScale ?? 'auto'} logical=${debug.previewLogicalWidth}x${debug.previewLogicalHeight}` : 'off'}`,
            `idle.armed: ${idle.armed}  timeout=${idle.timeoutSeconds}s (${idle.source})`,
            `viewportOffset: ${layout.viewportOffsetX}, ${layout.viewportOffsetY}  layout.scale=${layout.scale}`,
            `orientation: ${layout.orientation}  config ${layout.width}x${layout.height}`,
            `windowBounds: ${layout.windowBounds.width}x${layout.windowBounds.height}`,
            `devicePixelRatio: ${window.devicePixelRatio}`,
            listStats
              ? [
                  `canvasCount: ${listStats.canvasCount}  css ${listStats.canvasCssWidth}x${listStats.canvasCssHeight}`,
                  `drawingBuffer: ${listStats.drawingBufferWidth}x${listStats.drawingBufferHeight}`,
                  `rendererPixelRatio: ${listStats.rendererPixelRatio}  dpr ${listStats.devicePixelRatio}`,
                  `fps: ${listStats.fps.toFixed(1)}  contextLost: ${listStats.contextLost}`,
                  `sourceImageCount: ${listStats.sourceImageCount}  displayed: ${listStats.displayedImageCount}`,
                  `realImageCount: ${listStats.realImageCount}  duplicated: ${listStats.duplicatedCount}`,
                  `textureLoaded: ${listStats.textureLoadedCount}  failed: ${listStats.textureFailedCount}`,
                  `cardGenerationMode: ${listStats.cardGenerationMode}  exploreSource: ${listStats.exploreSource}`,
                  `firstImageUrlScheme: ${listStats.firstImageUrlScheme}`,
                  `camera: ${listStats.cameraX.toFixed(0)}, ${listStats.cameraY.toFixed(0)}, ${listStats.cameraZ.toFixed(0)}`,
                  `dollyVelocity: ${listStats.dollyVelocity.toFixed(1)}  lastInput: ${listStats.lastDollyInput}  wrap: ${listStats.wrapCount}`,
                  `bubble visible=${listStats.bubbleVisible} allowed=${listStats.bubbleAllowed} reveal=${listStats.revealActive}`,
                  `bubbleScreen: ${listStats.bubbleScreenX.toFixed(0)}, ${listStats.bubbleScreenY.toFixed(0)}  r=${listStats.revealRadiusPx} size=${listStats.bubbleSizePx}`,
                  `pointers: ${listStats.activePointerCount}  pinch: ${listStats.pinchActive}`,
                  `tapped: ${tappedCard?.instanceId ?? listStats.selectedInstanceId ?? 'none'} src=${tappedCard?.sourceImageId ?? listStats.selectedSourceImageId ?? 'none'}`,
                ].join('\n')
              : 'listStats: (not mounted — AD_IDLE / ANIMATION)',
            contentValidation
              ? [
                  `unsupportedFileCount: ${contentValidation.unsupportedFileCount}`,
                  `validationWarningCount: ${contentValidation.validationWarningCount}`,
                  `filenameWarningCount: ${contentValidation.filenameWarningCount}`,
                  `exploreSource(validation): ${contentValidation.exploreSource}  sourceImageCount: ${contentValidation.sourceImageCount}`,
                  `expectedDisplayedCount: ${contentValidation.expectedDisplayedCount}`,
                  `listDir: ${contentValidation.listDirImageCount}  recursive: ${contentValidation.recursiveImageCount}`,
                  `categoryIdAssigned: ${contentValidation.categoryIdAssignedCount}  duplicateIds: ${contentValidation.duplicateIdCount}`,
                  `categories.json: ${contentValidation.categoriesPresent}  content/Logo: ${contentValidation.contentLogoDirPresent}`,
                ].join('\n')
              : 'content validation: loading…',
          ].join('\n')}
        </pre>
        <h2>All monitors (overlay independence)</h2>
        <div className="monitor-grid">
          {monitors.map((row) => (
            <div
              key={row.monitorId}
              className={`monitor-cell ${row.interactionLocked ? 'is-locked' : 'is-free'}${row.monitorId === monitorId ? ' is-self' : ''}`}
            >
              {`M${row.monitorId}${row.monitorId === monitorId ? ' (this)' : ''}\n${row.localOverlay}\nlocked: ${row.interactionLocked}\nimg: ${row.selectedImageId ?? '—'}\ncat: ${row.selectedCategoryId ?? '—'}`}
            </div>
          ))}
        </div>
        <h2>Global</h2>
        <div className="actions">
          <button type="button" disabled={globalScene !== 'AD_IDLE'} onClick={() => void dispatch({ type: 'SET_GLOBAL_SCENE', scene: 'ANIMATION' })}>
            → ANIMATION
          </button>
          <button type="button" disabled={globalScene !== 'ANIMATION'} onClick={() => void dispatch({ type: 'SET_GLOBAL_SCENE', scene: 'PRODUCT_LIST' })}>
            → PRODUCT_LIST
          </button>
          <button type="button" disabled={globalScene !== 'PRODUCT_LIST'} onClick={() => void dispatch({ type: 'SET_GLOBAL_SCENE', scene: 'AD_IDLE' })}>
            → AD_IDLE
          </button>
        </div>
        <h2>Local overlay (this monitorId)</h2>
        <div className="actions">
          <button type="button" disabled={!listActive || own.localOverlay !== 'NONE'} onClick={() => void dispatch({ type: 'OPEN_IMAGE_ZOOM', imageId: tappedCard?.sourceImageId })}>
            M{monitorId} IMAGE_ZOOM
          </button>
          <button type="button" disabled={!listActive || own.localOverlay !== 'NONE'} onClick={() => void dispatch({ type: 'OPEN_CATEGORY_DRAWER' })}>
            M{monitorId} DRAWER
          </button>
          <button
            type="button"
            disabled={!listActive || own.localOverlay !== 'CATEGORY_DRAWER' || !firstCategoryId}
            onClick={() => void dispatch({ type: 'OPEN_CATEGORY_MODAL', categoryId: firstCategoryId })}
          >
            M{monitorId} MODAL
          </button>
          <button type="button" disabled={!listActive || own.localOverlay === 'NONE'} onClick={() => void dispatch({ type: 'CLOSE_OVERLAY' })}>
            M{monitorId} close overlay
          </button>
        </div>
        <p className="hint">
          AD_IDLE: tap stage → ANIMATION. ANIMATION: stage tap ignored. PRODUCT_LIST: this window only pan / pinch / Bubble.
          Overlay is this monitor only. Hamburger opens Drawer; tap scrim to close (no ×). Keys 1/2/3 Z/H/C X. D/G toggles debug/review. P toggles debug panel. R forces review.
        </p>
        <pre className="debug-pre debug-pre--dump">
          {JSON.stringify(
            {
              globalScene,
              adMode,
              isDevFallback: debug.isDevFallback,
              isPreviewMode: Boolean(debug.isPreviewMode),
              uiMode,
              previewWindows: debug.previewWindows ?? 'off',
              previewMode: debug.previewMode ?? 'off',
              previewScale: debug.previewScale ?? null,
              listPreloadStatus: preload,
              preloadReadyBeforeListEnter,
              preloadDurationMs: livePreloadMs,
              nearFade: {
                start: CARD_MOTION.nearFadeStartDist,
                end: CARD_MOTION.nearFadeEndDist,
                nearScaleStartUsed: CARD_MOTION.nearScaleEnabled,
                nearScaleMinUsed: CARD_MOTION.nearScaleEnabled,
                maxScaleClamp: CARD_MOTION.maxScaleClamp,
                maxApparentScaleDist: CARD_MOTION.maxApparentScaleDist,
                fadeAlpha: listStats?.nearFadeAlpha ?? null,
              },
              noiseOpacity: listConfig.noiseOpacity,
              listImageCount: contentValidation?.listDirImageCount ?? listStats?.realImageCount ?? null,
              listSourceMode: listStats?.exploreSource ?? contentValidation?.exploreSource ?? null,
              categoryFoodFolderCount: contentValidation?.foodFolderCount ?? null,
              categoryFoodSlideCount: modalOpen && gallery ? gallery.images.length : contentValidation?.categoryFoodSlideCount ?? null,
              coverImageCount: contentValidation?.coverImageCount ?? null,
              textLoaded: contentValidation?.textLoaded ?? sharedCopy?.found ?? null,
              textSource: contentValidation?.textSource ?? sharedCopy?.relativePath ?? null,
              adsVideoMode: contentValidation?.adsVideoMode ?? null,
              adsVideoFiles: contentValidation?.adsVideoFiles ?? null,
              animationVideoMode: contentValidation?.animationVideoMode ?? null,
              animationVideoFiles: contentValidation?.animationVideoFiles ?? null,
              runtime: {
                visualPresetId: runtimeConfig.visualPresetId,
                bubbleMotionId: runtimeConfig.bubbleMotionId,
                bubbleSizePx: runtimeConfig.bubbleSizePx,
                revealRadiusPx: runtimeConfig.revealRadiusPx,
                listMotionSpeed: runtimeConfig.listMotionSpeed,
                dollyFeel,
                cameraDollySpeed: runtimeConfig.cameraDollySpeed,
                dollyPoseSmoothing: runtimeConfig.dollyPoseSmoothing,
                pinchDollyScale: runtimeConfig.pinchDollyScale,
              },
              video: { scene: video.scene, sessionId: video.sessionId, trackFound: video.track.found },
              idle,
              contentValidation,
              list: listStats
                ? {
                    fps: Number(listStats.fps.toFixed(1)),
                    displayedImageCount: listStats.displayedImageCount,
                    densityPreset: listStats.densityPreset,
                    sceneSpreadX: listStats.sceneSpreadX,
                    sceneSpreadY: listStats.sceneSpreadY,
                    sceneSpreadZ: listStats.sceneSpreadZ,
                    textureLoadedCount: listStats.textureLoadedCount,
                    cameraZ: Number(listStats.cameraZ.toFixed(1)),
                    dollyVelocity: Number(listStats.dollyVelocity.toFixed(1)),
                    bubbleVisible: listStats.bubbleVisible,
                    contextLost: listStats.contextLost,
                  }
                : null,
              monitors: monitors.map((m) => ({
                monitorId: m.monitorId,
                localOverlay: m.localOverlay,
                interactionLocked: m.interactionLocked,
                selectedImageId: m.selectedImageId,
                selectedCategoryId: m.selectedCategoryId,
              })),
              logo: logo ? { found: logo.found, fileName: logo.fileName } : null,
              galleryCount: gallery?.images.length ?? 0,
            },
            null,
            2,
          )}
        </pre>
        <p className="error">{error}</p>
      </section>
    </div>
  );
}
