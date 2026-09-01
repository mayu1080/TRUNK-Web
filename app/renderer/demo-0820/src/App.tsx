import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppConfig, MonitorState, StateAction } from './trunkApi';
import { DEMO_PHASE, demoConfig } from './demoConfig';
import { AnimationScreen } from './screens/AnimationScreen';
import { ImageZoomOverlay } from './screens/ImageZoomOverlay';
import { ProductDetailSlot } from './screens/ProductDetailSlot';
import { ProductListScreen } from './screens/ProductListScreen';
import { TopScreen } from './screens/TopScreen';
import { DebugHud } from './ui/DebugHud';
import { DemoToggles } from './ui/DemoToggles';
import { CategoryDrawer } from './ui/CategoryDrawer';
import { ListLogo, type LogoAssetStatus } from './ui/ListLogo';
import { DRAWER_MOTION, labelForCategoryId } from './drawerMotion';
import { isDebugMode, type UiDisplayMode } from './uiMode';
import { computeUiScale } from './uiScale';
import type { ContentLoadStatus, ImageZoomLoadStatus, ListDebugStats, SelectedDemoCard } from './types';
import {
  DOLLY_FEEL_PRESETS,
  patchRuntimeConfig,
  runtimeConfig,
  type BubbleMotionId,
  type DollyFeelId,
  type PixelRatioCap,
  type VisualPresetId,
} from './runtimeConfig';

const ANIMATION_MIN_MS = 2000;
/** ANIMATION が無限に止まらないための上限。通常はテクスチャ ready で先に抜ける。 */
const ANIMATION_READY_CAP_MS = 12000;

function isListContentSettled(status: ContentLoadStatus | undefined): boolean {
  return status === 'loaded' || status === 'error' || status === 'fallback';
}

function readViewport() {
  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
  };
}

export function App() {
  const [monitorState, setMonitorState] = useState<MonitorState | null>(null);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [uiMode, setUiMode] = useState<UiDisplayMode>(
    demoConfig.reviewMode ? 'review' : 'debug',
  );
  const [viewport, setViewport] = useState(readViewport);
  const [listStats, setListStats] = useState<ListDebugStats | null>(null);
  const [runtimeTick, setRuntimeTick] = useState(0);
  const [selectedCard, setSelectedCard] = useState<SelectedDemoCard | null>(null);
  const [imageZoomLoadStatus, setImageZoomLoadStatus] = useState<ImageZoomLoadStatus>('idle');
  const [drawerSelectedCategoryId, setDrawerSelectedCategoryId] = useState<string | null>(null);
  const [listReady, setListReady] = useState(false);
  const [logoStatus, setLogoStatus] = useState<LogoAssetStatus | null>(null);
  const showHudRef = useRef(false);
  const drawerOpenRef = useRef(false);
  const listReadyRef = useRef(false);
  const animationEnteredAtRef = useRef<number | null>(null);
  const animationCompleteSentRef = useRef(false);

  const reviewMode = !isDebugMode(uiMode);
  const showHud = !reviewMode && demoConfig.debugHudEnabled;
  showHudRef.current = showHud;
  const uiScale = computeUiScale(viewport.innerWidth, viewport.innerHeight);

  const handleStats = useCallback((stats: ListDebugStats) => {
    if (isListContentSettled(stats.contentLoadStatus)) {
      listReadyRef.current = true;
      setListReady(true);
    }
    if (showHudRef.current) setListStats(stats);
  }, []);

  const handleLogoStatus = useCallback((status: LogoAssetStatus) => {
    setLogoStatus(status);
  }, []);

  const handleContentSettled = useCallback((status: ContentLoadStatus) => {
    if (!isListContentSettled(status)) return;
    listReadyRef.current = true;
    setListReady(true);
  }, []);

  const dispatch = useCallback(async (action: StateAction) => {
    try {
      await window.trunkApi.dispatch(action);
    } catch (err) {
      setBootError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const handleCardTap = useCallback(async (card: SelectedDemoCard) => {
    if (!card.instanceId) return;
    if (drawerOpenRef.current) return;
    setSelectedCard(card);
    setImageZoomLoadStatus(card.imageUrl ? 'loading' : 'error');
    try {
      await window.trunkApi.dispatch({ type: 'LIST_IMAGE_TAP', imageId: card.instanceId });
    } catch (err) {
      setSelectedCard(null);
      setImageZoomLoadStatus('idle');
      setBootError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const handleImageZoomClose = useCallback(async () => {
    try {
      await window.trunkApi.dispatch({ type: 'IMAGE_ZOOM_CLOSE' });
    } catch (err) {
      setBootError(err instanceof Error ? err.message : String(err));
      return;
    }
    setSelectedCard(null);
    setImageZoomLoadStatus('idle');
  }, []);

  const handleDrawerOpen = useCallback(async () => {
    try {
      await window.trunkApi.dispatch({ type: 'CATEGORY_DRAWER_OPEN' });
    } catch (err) {
      setBootError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const handleDrawerClose = useCallback(async () => {
    try {
      await window.trunkApi.dispatch({ type: 'CATEGORY_DRAWER_CLOSE' });
    } catch (err) {
      setBootError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const handleSelectCategory = useCallback(async (categoryId: string) => {
    if (!categoryId) return;
    setDrawerSelectedCategoryId(categoryId);
    console.info('[0820] category select', { categoryId });
    try {
      await window.trunkApi.dispatch({ type: 'CATEGORY_SELECT', categoryId });
    } catch (err) {
      setBootError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const handleProductDetailClose = useCallback(async () => {
    try {
      await window.trunkApi.dispatch({ type: 'PRODUCT_DETAIL_CLOSE' });
    } catch (err) {
      setBootError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const commitRuntime = useCallback((patch: Parameters<typeof patchRuntimeConfig>[0]) => {
    patchRuntimeConfig(patch);
    setRuntimeTick((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!window.trunkApi) {
      setBootError('trunkApi is not available (preload missing)');
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    (async () => {
      try {
        const [config, state] = await Promise.all([
          window.trunkApi.getConfig(),
          window.trunkApi.getState(),
        ]);
        if (cancelled) return;
        setAppConfig(config);
        setMonitorState(state);
        unsubscribe = window.trunkApi.onStateChanged((next) => {
          setMonitorState(next);
          if (next.screenState === 'TOP') {
            listReadyRef.current = false;
            setListReady(false);
            setListStats(null);
            setSelectedCard(null);
            setImageZoomLoadStatus('idle');
            setDrawerSelectedCategoryId(null);
          } else if (next.screenState === 'ANIMATION') {
            setSelectedCard(null);
            setImageZoomLoadStatus('idle');
            setDrawerSelectedCategoryId(null);
          }
        });
        await window.trunkApi.logEvent({
          level: 'info',
          message: '0820 demo renderer ready',
          context: { phase: DEMO_PHASE, screenState: state.screenState },
        });
      } catch (err) {
        if (!cancelled) {
          setBootError(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    const onResize = () => setViewport(readViewport());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
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
    if (monitorState?.screenState !== 'ANIMATION') {
      animationEnteredAtRef.current = null;
      animationCompleteSentRef.current = false;
      return;
    }
    if (animationEnteredAtRef.current == null) {
      animationEnteredAtRef.current = Date.now();
    }

    let cancelled = false;
    const tryComplete = () => {
      if (cancelled || animationCompleteSentRef.current) return;
      const startedAt = animationEnteredAtRef.current;
      if (startedAt == null) return;
      const elapsed = Date.now() - startedAt;
      if (elapsed < ANIMATION_MIN_MS) return;
      if (!listReadyRef.current && elapsed < ANIMATION_READY_CAP_MS) return;
      animationCompleteSentRef.current = true;
      void dispatch({ type: 'ANIMATION_COMPLETE' });
    };

    const startedAt = animationEnteredAtRef.current;
    const elapsed = Date.now() - startedAt;
    const minWait = Math.max(0, ANIMATION_MIN_MS - elapsed);
    const capWait = Math.max(0, ANIMATION_READY_CAP_MS - elapsed);
    const minTimer = window.setTimeout(tryComplete, minWait);
    const capTimer = window.setTimeout(tryComplete, capWait);
    tryComplete();

    return () => {
      cancelled = true;
      window.clearTimeout(minTimer);
      window.clearTimeout(capTimer);
    };
  }, [monitorState?.screenState, listReady, dispatch]);

  useEffect(() => {
    patchRuntimeConfig({ reportStatsToHud: showHud });
  }, [showHud]);

  if (bootError) {
    return (
      <div className="demo-0820 demo-0820--error">
        <p>0820 demo failed to start</p>
        <pre>{bootError}</pre>
      </div>
    );
  }

  if (!monitorState) {
    return (
      <div className="demo-0820 demo-0820--boot">
        <p>loading 0820 demo…</p>
      </div>
    );
  }

  const imageZoomOpen = monitorState.screenState === 'IMAGE_ZOOM';
  const productDetailOpen = monitorState.screenState === 'PRODUCT_DETAIL';
  const isAnimation = monitorState.screenState === 'ANIMATION';
  const exploreHostMounted =
    isAnimation ||
    monitorState.screenState === 'PRODUCT_LIST' ||
    monitorState.screenState === 'IMAGE_ZOOM' ||
    monitorState.screenState === 'PRODUCT_DETAIL';
  const drawerOpen =
    monitorState.screenState === 'PRODUCT_LIST' && monitorState.uiState.categoryDrawer === 'open';
  drawerOpenRef.current = drawerOpen;
  const hamburgerVisible = monitorState.screenState === 'PRODUCT_LIST';
  const hamburgerMode: 'bars' | 'close' = drawerOpen ? 'close' : 'bars';
  const drawerScrimVisible = drawerOpen && DRAWER_MOTION.showScrimDefault;
  const selectedCategoryId = monitorState.selectedCategoryId ?? drawerSelectedCategoryId;
  const selectedCategoryLabel = labelForCategoryId(selectedCategoryId);
  const exploreInteractionEnabled =
    monitorState.screenState === 'PRODUCT_LIST' &&
    monitorState.uiState.categoryDrawer === 'closed' &&
    !imageZoomOpen &&
    !productDetailOpen;

  return (
    <div
      className={`demo-0820 ${reviewMode ? 'review-mode' : 'debug-mode'}`}
      data-screen={monitorState.screenState}
      data-phase={DEMO_PHASE}
      data-runtime-tick={runtimeTick}
      data-image-zoom-open={imageZoomOpen ? 'true' : 'false'}
      data-product-detail-open={productDetailOpen ? 'true' : 'false'}
      data-drawer-open={drawerOpen ? 'true' : 'false'}
      data-hamburger-visible={hamburgerVisible ? 'true' : 'false'}
      data-hamburger-mode={hamburgerVisible ? hamburgerMode : 'hidden'}
      data-explore-mounted={exploreHostMounted ? 'true' : 'false'}
      data-list-ready={listReady ? 'true' : 'false'}
      data-list-warmup={isAnimation ? 'true' : 'false'}
    >
      {monitorState.screenState === 'TOP' && (
        <TopScreen onStart={() => void dispatch({ type: 'TOP_ENTRY_TAP' })} />
      )}
      {exploreHostMounted && (
        <ProductListScreen
          onStats={handleStats}
          onCardTap={handleCardTap}
          onContentSettled={handleContentSettled}
          interactionEnabled={exploreInteractionEnabled}
          overlayOpen={imageZoomOpen || productDetailOpen}
          imageZoomLoadStatus={imageZoomLoadStatus}
          warmup={isAnimation}
        />
      )}
      {monitorState.screenState === 'PRODUCT_LIST' && (
        <div hidden={drawerOpen} className="logo-plate-slot">
          <ListLogo onStatus={handleLogoStatus} />
        </div>
      )}
      {isAnimation && <AnimationScreen />}
      {monitorState.screenState === 'IMAGE_ZOOM' && selectedCard && (
        <ImageZoomOverlay
          key={selectedCard.instanceId}
          card={selectedCard}
          onClose={() => void handleImageZoomClose()}
          onLoadStatus={setImageZoomLoadStatus}
        />
      )}
      {productDetailOpen && (
        <ProductDetailSlot
          categoryId={monitorState.selectedCategoryId}
          categoryLabel={labelForCategoryId(monitorState.selectedCategoryId)}
          onClose={() => void handleProductDetailClose()}
        />
      )}

      {hamburgerVisible && (
        <div className="ui-chrome-layer">
          <button
            type="button"
            className="hamburger"
            aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
            onClick={() => {
              if (drawerOpen) void handleDrawerClose();
              else void handleDrawerOpen();
            }}
          >
            {drawerOpen ? (
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
        </div>
      )}
      {monitorState.screenState === 'PRODUCT_LIST' && (
        <CategoryDrawer
          open={drawerOpen}
          selectedCategoryId={drawerSelectedCategoryId}
          showScrim={DRAWER_MOTION.showScrimDefault}
          onClose={() => void handleDrawerClose()}
          onSelectCategory={handleSelectCategory}
        />
      )}

      {showHud && (
        <DebugHud
          screenState={monitorState.screenState}
          reviewMode={reviewMode}
          debugHudEnabled={demoConfig.debugHudEnabled}
          innerWidth={viewport.innerWidth}
          innerHeight={viewport.innerHeight}
          devicePixelRatio={viewport.devicePixelRatio}
          uiScale={uiScale}
          demoMode={demoConfig.demoMode}
          forceSingleMonitor={demoConfig.forceSingleMonitor}
          monitorId={appConfig?.monitorId ?? null}
          monitorCount={appConfig?.monitorCount ?? null}
          categoryDrawer={monitorState.uiState.categoryDrawer}
          selectedCategoryId={selectedCategoryId}
          selectedCategoryLabel={selectedCategoryLabel}
          productDetailOpen={productDetailOpen}
          drawerOpen={drawerOpen}
          drawerScrimVisible={drawerScrimVisible}
          hamburgerVisible={hamburgerVisible}
          hamburgerMode={hamburgerMode}
          selectedListImageId={monitorState.selectedListImageId}
          imageZoomOpen={imageZoomOpen}
          imageZoomLoadStatus={imageZoomLoadStatus}
          exploreHostMounted={exploreHostMounted}
          listReady={listReady}
          selectedCard={selectedCard}
          listStats={listStats}
          logoStatus={logoStatus}
        />
      )}
      <DemoToggles
        presetId={runtimeConfig.visualPresetId}
        onPresetChange={(id: VisualPresetId) => commitRuntime({ visualPresetId: id })}
        bubbleMotionId={runtimeConfig.bubbleMotionId}
        onBubbleMotionChange={(id: BubbleMotionId) => commitRuntime({ bubbleMotionId: id })}
        uiMode={uiMode}
        onUiModeChange={setUiMode}
        pixelRatioCap={runtimeConfig.rendererPixelRatioMax}
        onPixelRatioCapChange={(v: PixelRatioCap) => commitRuntime({ rendererPixelRatioMax: v })}
        bubbleSizePx={runtimeConfig.bubbleSizePx}
        onBubbleSizeChange={(v) => commitRuntime({ bubbleSizePx: v })}
        revealRadiusPx={runtimeConfig.revealRadiusPx}
        onRevealRadiusChange={(v) => commitRuntime({ revealRadiusPx: v })}
        listMotionSpeed={runtimeConfig.listMotionSpeed}
        onListMotionSpeedChange={(v) => commitRuntime({ listMotionSpeed: v })}
        cameraDollySpeed={runtimeConfig.cameraDollySpeed}
        onCameraDollySpeedChange={(v) => commitRuntime({ cameraDollySpeed: v })}
        dollyCruiseEnabled={runtimeConfig.dollyCruiseEnabled}
        onDollyCruiseEnabledChange={(v) => commitRuntime({ dollyCruiseEnabled: v })}
        dollyPoseSmoothing={runtimeConfig.dollyPoseSmoothing}
        onDollyPoseSmoothingChange={(v) => commitRuntime({ dollyPoseSmoothing: v })}
        pinchDollyScale={runtimeConfig.pinchDollyScale}
        onPinchDollyScaleChange={(v) => commitRuntime({ pinchDollyScale: v })}
        onDollyFeelChange={(id: DollyFeelId) => {
          const feel = DOLLY_FEEL_PRESETS[id];
          if (!feel) return;
          commitRuntime({
            cameraDollySpeed: feel.cameraDollySpeed,
            dollyPoseSmoothing: feel.dollyPoseSmoothing,
            pinchDollyScale: feel.pinchDollyScale,
          });
        }}
        fps={listStats?.fps ?? null}
      />
    </div>
  );
}
