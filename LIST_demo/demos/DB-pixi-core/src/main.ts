import { loadListImages } from './assetAdapter';
import { WORLD_HEIGHT, WORLD_WIDTH } from './constants';
import { DebugPanel, FpsCounter, formatPresetDistribution } from './debugPanel';
import {
  applyExploreView,
  buildExploreScene,
  countDrawCallEstimate,
  hitTestImage,
  type ExploreScene,
} from './exploreScene';
import { attachWheelZoom, GestureController } from './gestureController';
import { centerInitialView, createPixiApp, getInitTimeMs } from './pixiApp';
import type { DebugStats, ExploreView, SelectedImageDebug } from './types';
import { ZoomOverlay } from './zoomOverlay';

async function main(): Promise<void> {
  const loadingEl = document.getElementById('loading');
  const host = document.getElementById('pixi-host');
  if (!host) throw new Error('#pixi-host not found');

  const bootStart = performance.now();
  const assetResult = await loadListImages();
  const warnings = [...assetResult.warnings];

  const { app, canvas, rendererType } = await createPixiApp(host);
  const initTimeMs = getInitTimeMs(canvas);

  let exploreView: ExploreView = { panX: 0, panY: 0, zoom: 0.85 };
  exploreView = centerInitialView(app, exploreView, WORLD_WIDTH, WORLD_HEIGHT);

  const scene: ExploreScene = await buildExploreScene(assetResult.images);
  app.stage.addChild(scene.world);
  applyExploreView(scene.world, exploreView);

  let selectedImageId: string | null = null;
  let selectedImageDebug: SelectedImageDebug | null = null;
  let interactionEnabled = true;

  const debugPanel = new DebugPanel();
  const fpsCounter = new FpsCounter();
  const zoomOverlay = new ZoomOverlay();

  const setInteraction = (enabled: boolean): void => {
    interactionEnabled = enabled;
    gesture.setEnabled(enabled);
  };

  const gesture = new GestureController(canvas, exploreView, {
    onViewChange(view) {
      exploreView = view;
      applyExploreView(scene.world, exploreView);
    },
    onTap(rendererX, rendererY) {
      if (!interactionEnabled || zoomOverlay.isOpen()) return;
      const hit = hitTestImage(scene.world, scene.images, rendererX, rendererY);
      if (!hit) return;

      selectedImageId = hit.meta.id;
      selectedImageDebug = {
        id: hit.meta.id,
        originalWidth: hit.display.originalWidth,
        originalHeight: hit.display.originalHeight,
        displayedWidth: hit.display.displayedWidth,
        displayedHeight: hit.display.displayedHeight,
        scale: hit.display.scale,
        preset: hit.display.preset,
      };
      setInteraction(false);
      zoomOverlay.open(hit.meta, () => {
        selectedImageId = null;
        selectedImageDebug = null;
        setInteraction(true);
      });
    },
  });

  const detachWheel = attachWheelZoom(
    canvas,
    () => exploreView,
    (v) => {
      exploreView = v;
      applyExploreView(scene.world, exploreView);
      gesture.setView(exploreView);
    },
    () => interactionEnabled && !zoomOverlay.isOpen(),
  );

  app.ticker.add(() => {
    const fps = fpsCounter.tick();
    const sizeStats = scene.displaySizeStats;
    const stats: DebugStats = {
      fps,
      assetMode: assetResult.assetMode,
      sourceRoot: assetResult.sourceRoot,
      scannedFolders: assetResult.scannedFolders.join(', '),
      includeDirs: assetResult.includeDirs.join(', '),
      excludeDirs: assetResult.excludeDirs.join(', '),
      realImageCount: assetResult.realImageCount,
      displayedImageCount: assetResult.displayedImageCount,
      duplicatedCount: assetResult.duplicatedCount,
      texturesLoaded: scene.texturesLoaded,
      displayMinLongSide: sizeStats.minLongSide,
      displayMaxLongSide: sizeStats.maxLongSide,
      displayAvgLongSide: sizeStats.avgLongSide,
      maxTargetLongSide: sizeStats.maxTargetLongSide,
      presetDistribution: formatPresetDistribution(sizeStats.presetCounts),
      selectedImage: selectedImageDebug,
      panX: exploreView.panX,
      panY: exploreView.panY,
      zoom: exploreView.zoom,
      selectedImageId,
      rendererType,
      canvasCount: document.querySelectorAll('canvas').length,
      warningCount: warnings.length,
      drawCallEstimate: countDrawCallEstimate(scene.images.length, 1),
      textureMemoryMb: scene.textureMemoryBytes / (1024 * 1024),
      loadTimeMs: scene.loadTimeMs,
      initTimeMs,
      devicePixelRatio: window.devicePixelRatio,
      interactionEnabled,
      overlayOpen: zoomOverlay.isOpen(),
    };
    debugPanel.render(stats, warnings);
  });

  if (loadingEl) loadingEl.classList.add('hidden');

  const bootMs = performance.now() - bootStart;
  console.info('[DB-pixi-core] ready', {
    source: assetResult.source,
    assetMode: assetResult.assetMode,
    realImages: assetResult.realImageCount,
    displayed: assetResult.displayedImageCount,
    duplicates: assetResult.duplicatedCount,
    folders: assetResult.scannedFolders,
    bootMs,
  });

  window.addEventListener('beforeunload', () => {
    detachWheel();
    gesture.destroy();
    app.destroy(true, { children: true, texture: true });
  });
}

main().catch((err) => {
  console.error(err);
  const loadingEl = document.getElementById('loading');
  if (loadingEl) {
    loadingEl.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
});
