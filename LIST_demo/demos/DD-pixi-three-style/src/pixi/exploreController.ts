import type { Application } from 'pixi.js';
import { loadListImages } from './assetAdapter';
import {
  applyExploreView,
  applyVisualConfigToScene,
  buildExploreScene,
  countDrawCallEstimate,
  hitTestImage,
  type ExploreScene,
  type PlacedImage,
} from './exploreScene';
import { FpsCounter } from './fpsCounter';
import { attachWheelZoom, GestureController, type TapGestureProbe } from './gestureController';
import {
  type HitTestDebugSnapshot,
  logHitTestSnapshot,
  probeDomAtPoint,
  runHitTestAt,
  type TapRejectedReason,
} from './hitTestDiagnostics';
import { centerInitialView, createPixiApp, getInitTimeMs } from './pixiApp';
import {
  animateTapFocus,
  applyTouchReaction,
  clearTouchReaction,
  createTouchReactionState,
  updateTouchReactionFromEvent,
} from './touchReaction';
import { clampExploreView, centerViewOnContent } from './worldBounds';
import type { AssetLoadResult, DebugStats, ExploreView, HitTestDebugStats, SelectedImageDebug } from './types';
import type { VisualConfig, VisualPresetId } from '../visualConfig';
import { DEFAULT_TONE_PRESET, getVisualConfig, type TonePresetId } from '../visualConfig';

export interface ExploreControllerCallbacks {
  onStats(stats: DebugStats, warnings: string[]): void;
  onImageTap(meta: { id: string; url: string }): void;
  onReady(): void;
  onHitTestSnapshot?(snapshot: HitTestDebugSnapshot): void;
}

export interface ExploreControllerOptions {
  host: HTMLElement;
  presetId: VisualPresetId;
  overlayState: string;
  drawerOpen: boolean;
  pointerBlocked: boolean;
}

export class ExploreController {
  private host!: HTMLElement;
  private app!: Application;
  private canvas!: HTMLCanvasElement;
  private scene!: ExploreScene;
  private assetResult!: AssetLoadResult;
  private warnings: string[] = [];
  private exploreView: ExploreView = { panX: 0, panY: 0, zoom: 1 };
  private gesture!: GestureController;
  private detachWheel: (() => void) | null = null;
  private fpsCounter = new FpsCounter();
  private touchState = createTouchReactionState();
  private config: VisualConfig;
  private tonePresetId: TonePresetId = DEFAULT_TONE_PRESET;
  private interactionEnabled = true;
  private selectedImageId: string | null = null;
  private selectedImageDebug: SelectedImageDebug | null = null;
  private rendererType = '';
  private initTimeMs = 0;
  private overlayState = 'normal';
  private drawerOpen = false;
  private pointerBlockedExternal = false;
  private destroyed = false;
  private tapLocked = false;
  private zoomCooldownUntil = 0;
  private lastStatsEmitMs = 0;
  private pendingStats: DebugStats | null = null;
  private static readonly STATS_EMIT_INTERVAL_MS = 200;
  private static readonly ZOOM_COOLDOWN_MS = 120;

  private hitTestDebugEnabled = false;
  private lastHitTestSnapshot: HitTestDebugSnapshot | null = null;
  private lastDomProbeAtDown: ReturnType<typeof probeDomAtPoint> | null = null;

  constructor(private callbacks: ExploreControllerCallbacks) {
    this.config = getVisualConfig('cultish-soft', DEFAULT_TONE_PRESET);
  }

  async init(host: HTMLElement, presetId: VisualPresetId, tonePresetId?: TonePresetId): Promise<void> {
    this.host = host;
    if (tonePresetId) this.tonePresetId = tonePresetId;
    this.config = getVisualConfig(presetId, this.tonePresetId);

    this.assetResult = await loadListImages();
    if (this.destroyed) return;
    this.warnings = [...this.assetResult.warnings];

    const { app, canvas, rendererType } = await createPixiApp(
      host,
      this.config.background.color,
    );
    if (this.destroyed) {
      app.destroy(true, { children: true, texture: true });
      return;
    }
    this.app = app;
    this.canvas = canvas;
    this.rendererType = rendererType;
    this.initTimeMs = getInitTimeMs(canvas);

    this.exploreView = {
      panX: 0,
      panY: 0,
      zoom: this.config.world.defaultZoom,
    };

    this.scene = await buildExploreScene(this.assetResult.images, this.config);
    if (this.destroyed) {
      app.destroy(true, { children: true, texture: true });
      return;
    }
    app.stage.addChild(this.scene.world);

    this.exploreView = centerInitialView(
      app,
      this.exploreView,
      this.config.world.width,
      this.config.world.height,
    );
    this.exploreView = centerViewOnContent(
      app.screen.width,
      app.screen.height,
      this.exploreView,
      this.scene.contentBounds,
    );
    this.exploreView = this.clampView(this.exploreView);
    applyExploreView(this.scene, this.exploreView, this.config, 0);

    this.gesture = new GestureController(canvas, this.exploreView, {
      onViewChange: (view) => {
        this.exploreView = view;
        applyExploreView(this.scene, this.exploreView, this.config, performance.now() / 1000);
      },
      onTap: (rx, ry, probe) => void this.handleTap(rx, ry, probe),
      onTapProbe: (probe) => this.recordTapProbe(probe),
      onPointerDown: (cx, cy) => {
        this.lastDomProbeAtDown = probeDomAtPoint(cx, cy);
        if (this.hitTestDebugEnabled) {
          console.log(
            '[DD hit test] pointerdown DOM:\n',
            this.lastDomProbeAtDown.elements.join('\n'),
          );
        }
        updateTouchReactionFromEvent(this.touchState, canvas, cx, cy, false);
      },
      onPointerMove: (cx, cy, dragging) => {
        updateTouchReactionFromEvent(this.touchState, canvas, cx, cy, dragging);
      },
      onPointerUp: () => clearTouchReaction(this.touchState),
    });

    this.gesture.setViewClamp((v) => this.clampView(v));

    this.detachWheel = attachWheelZoom(
      canvas,
      () => this.exploreView,
      (v) => {
        this.exploreView = this.clampView(v);
        applyExploreView(this.scene, this.exploreView, this.config, performance.now() / 1000);
        this.gesture.setView(this.exploreView);
      },
      () => this.interactionEnabled,
    );

    app.ticker.add(() => {
      if (this.destroyed) return;
      const time = performance.now() / 1000;
      applyTouchReaction(
        this.scene.images,
        this.touchState,
        this.exploreView.panX,
        this.exploreView.panY,
        this.exploreView.zoom,
        this.config,
        time,
      );
      applyExploreView(this.scene, this.exploreView, this.config, time);
      this.emitStats();
    });

    this.callbacks.onReady();
  }

  setHitTestDebugEnabled(enabled: boolean): void {
    this.hitTestDebugEnabled = enabled;
  }

  getHitTestDebugSnapshot(): HitTestDebugSnapshot | null {
    return this.lastHitTestSnapshot;
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.canvas ?? null;
  }

  private recordTapProbe(probe: TapGestureProbe): void {
    if (!this.scene) return;

    const time = performance.now() / 1000;
    applyExploreView(this.scene, this.exploreView, this.config, time);

    const dom = this.lastDomProbeAtDown ?? probeDomAtPoint(probe.clientDownX, probe.clientDownY);
    const atUp = runHitTestAt(this.scene.world, this.scene.images, probe.canvasUpX, probe.canvasUpY);
    const atDown = runHitTestAt(
      this.scene.world,
      this.scene.images,
      probe.canvasDownX,
      probe.canvasDownY,
    );

    let tapRejectedReason: TapRejectedReason = probe.tapRejectedReason;
    if (probe.wasTap) {
      if (!this.interactionEnabled || this.pointerBlockedExternal) {
        tapRejectedReason = 'blocked';
      } else if (this.tapLocked) {
        tapRejectedReason = 'locked';
      } else if (performance.now() < this.zoomCooldownUntil) {
        tapRejectedReason = 'cooldown';
      } else if (!atUp.chosen) {
        tapRejectedReason = 'noCandidate';
      }
    }

    const snapshot: HitTestDebugSnapshot = {
      timestamp: performance.now(),
      clientDown: { x: probe.clientDownX, y: probe.clientDownY },
      clientUp: { x: probe.clientUpX, y: probe.clientUpY },
      canvasDown: { x: probe.canvasDownX, y: probe.canvasDownY },
      canvasUp: { x: probe.canvasUpX, y: probe.canvasUpY },
      worldDown: atDown.world,
      worldUp: atUp.world,
      moveDistancePx: probe.moveDistancePx,
      durationMs: probe.durationMs,
      wasDragging: probe.wasDragging,
      wasTap: probe.wasTap,
      tapRejectedReason,
      pointerTarget: dom.pointerTarget,
      elementsFromPoint: dom.elements,
      domBlocksCanvas: dom.domBlocksCanvas,
      hitCandidates: atUp.candidates,
      hitCandidatesAtDown: atDown.candidates,
      chosenImageId: atUp.chosen?.imageId ?? null,
      chosenBounds: atUp.chosen?.bounds ?? null,
      chosenAtDownImageId: atDown.chosen?.imageId ?? null,
      tapMoveThresholdPx: probe.tapMoveThresholdPx,
      tapMaxDurationMs: probe.tapMaxDurationMs,
      panStartThresholdPx: probe.panStartThresholdPx,
    };

    this.lastHitTestSnapshot = snapshot;
    this.callbacks.onHitTestSnapshot?.(snapshot);

    if (this.hitTestDebugEnabled) {
      logHitTestSnapshot(snapshot);
    }
  }

  private async handleTap(
    rx: number,
    ry: number,
    _probe: TapGestureProbe,
  ): Promise<void> {
    if (!this.interactionEnabled || this.tapLocked) return;
    if (performance.now() < this.zoomCooldownUntil) return;

    const time = performance.now() / 1000;
    applyExploreView(this.scene, this.exploreView, this.config, time);

    const hit = hitTestImage(this.scene.world, this.scene.images, rx, ry);
    if (!hit) return;

    this.tapLocked = true;
    this.setInteraction(false);

    this.selectedImageId = hit.meta.id;
    this.selectedImageDebug = {
      id: hit.meta.id,
      originalWidth: hit.display.originalWidth,
      originalHeight: hit.display.originalHeight,
      displayedWidth: hit.display.displayedWidth,
      displayedHeight: hit.display.displayedHeight,
      scale: hit.display.scale,
      preset: hit.display.preset,
      depth: hit.depth,
    };

    try {
      await animateTapFocus(hit, this.config);
      if (this.destroyed) return;
      this.callbacks.onImageTap({ id: hit.meta.id, url: hit.meta.url });
    } catch (err) {
      console.error('[DD] handleTap failed', err);
      this.tapLocked = false;
      this.setInteraction(!this.pointerBlockedExternal);
    }
  }

  setPreset(presetId: VisualPresetId): void {
    this.config = getVisualConfig(presetId, this.tonePresetId);
    if (!this.scene || !this.app) return;
    applyVisualConfigToScene(this.scene, this.config);
    this.app.renderer.background.color = this.config.background.color;
    this.exploreView = this.clampView(this.exploreView);
    this.gesture?.setView(this.exploreView);
  }

  setTonePreset(tonePresetId: TonePresetId): void {
    this.tonePresetId = tonePresetId;
    this.config = getVisualConfig(this.config.presetId, tonePresetId);
    if (!this.scene) return;
    applyVisualConfigToScene(this.scene, this.config);
  }

  getTonePresetId(): TonePresetId {
    return this.tonePresetId;
  }

  private clampView(view: ExploreView): ExploreView {
    if (!this.scene || !this.app) return view;
    return clampExploreView(
      view,
      this.app.screen.width,
      this.app.screen.height,
      this.scene.contentBounds,
      this.config.world,
    );
  }

  getConfig(): VisualConfig {
    return this.config;
  }

  setUiState(overlayState: string, drawerOpen: boolean, pointerBlocked: boolean): void {
    this.overlayState = overlayState;
    this.drawerOpen = drawerOpen;
    this.pointerBlockedExternal = pointerBlocked;
    const enabled = !pointerBlocked;
    this.setInteraction(enabled);
  }

  setInteraction(enabled: boolean): void {
    this.interactionEnabled =
      enabled && !this.pointerBlockedExternal && !this.tapLocked;
    this.gesture?.setEnabled(this.interactionEnabled);
    if (!this.interactionEnabled) {
      clearTouchReaction(this.touchState);
    }
  }

  onZoomClosed(): void {
    this.selectedImageId = null;
    this.selectedImageDebug = null;
    this.tapLocked = false;
    this.zoomCooldownUntil = performance.now() + ExploreController.ZOOM_COOLDOWN_MS;
    this.setInteraction(!this.pointerBlockedExternal);
  }

  private emitStats(): void {
    const fps = this.fpsCounter.tick();
    const cfg = this.config;
    const stats: DebugStats = {
      demoId: 'DD',
      fps,
      visualPreset: cfg.presetId,
      tonePreset: this.tonePresetId,
      imageBrightness: cfg.image.brightness,
      imageContrast: cfg.image.contrast,
      noiseEnabled: cfg.background.noiseEnabled,
      noiseOpacity: cfg.background.noiseOpacity,
      depthEnabled: cfg.depth.enabled,
      depthLayers: cfg.depth.layers,
      parallaxStrength: cfg.depth.parallaxStrength,
      floatEnabled: cfg.float.enabled,
      floatAmplitude: cfg.float.amplitudeY,
      touchReactionEnabled: cfg.touchReaction.enabled,
      touchReactionStrength: cfg.touchReaction.strength,
      overlayState: this.overlayState,
      drawerOpen: this.drawerOpen,
      pointerBlocked: this.pointerBlockedExternal || !this.interactionEnabled,
      assetMode: this.assetResult.assetMode,
      sourceRoot: this.assetResult.sourceRoot,
      scannedFolders: this.assetResult.scannedFolders.join(', '),
      realImageCount: this.assetResult.realImageCount,
      displayedImageCount: this.assetResult.displayedImageCount,
      duplicatedCount: this.assetResult.duplicatedCount,
      texturesLoaded: this.scene.texturesLoaded,
      selectedImage: this.selectedImageDebug,
      panX: this.exploreView.panX,
      panY: this.exploreView.panY,
      zoom: this.exploreView.zoom,
      selectedImageId: this.selectedImageId,
      rendererType: this.rendererType,
      canvasCount: document.querySelectorAll('canvas').length,
      warningCount: this.warnings.length,
      drawCallEstimate: countDrawCallEstimate(this.scene.images.length, this.scene.images.length),
      textureMemoryMb: this.scene.textureMemoryBytes / (1024 * 1024),
      loadTimeMs: this.scene.loadTimeMs,
      initTimeMs: this.initTimeMs,
      devicePixelRatio: window.devicePixelRatio,
      interactionEnabled: this.interactionEnabled,
      tapLocked: this.tapLocked,
      hitTestDebug: this.toHitTestDebugStats(this.lastHitTestSnapshot),
      hitTestDebugEnabled: this.hitTestDebugEnabled,
    };

    this.pendingStats = stats;
    const now = performance.now();
    if (now - this.lastStatsEmitMs < ExploreController.STATS_EMIT_INTERVAL_MS) return;
    this.lastStatsEmitMs = now;
    this.callbacks.onStats(this.pendingStats, this.warnings);
  }

  private toHitTestDebugStats(snapshot: HitTestDebugSnapshot | null): HitTestDebugStats | null {
    if (!snapshot) return null;
    return {
      clientDownX: snapshot.clientDown.x,
      clientDownY: snapshot.clientDown.y,
      clientUpX: snapshot.clientUp.x,
      clientUpY: snapshot.clientUp.y,
      canvasDownX: snapshot.canvasDown.x,
      canvasDownY: snapshot.canvasDown.y,
      canvasUpX: snapshot.canvasUp.x,
      canvasUpY: snapshot.canvasUp.y,
      worldDownX: snapshot.worldDown.x,
      worldDownY: snapshot.worldDown.y,
      worldUpX: snapshot.worldUp.x,
      worldUpY: snapshot.worldUp.y,
      moveDistancePx: snapshot.moveDistancePx,
      durationMs: snapshot.durationMs,
      wasDragging: snapshot.wasDragging,
      wasTap: snapshot.wasTap,
      tapRejectedReason: snapshot.tapRejectedReason,
      pointerTarget: snapshot.pointerTarget,
      elementsFromPointTop: snapshot.elementsFromPoint[0] ?? '(none)',
      domBlocksCanvas: snapshot.domBlocksCanvas,
      hitCandidateCount: snapshot.hitCandidates.length,
      hitCandidates: snapshot.hitCandidates.map((c) => ({
        imageId: c.imageId,
        depth: c.depth,
        layerId: c.layerId,
        zIndex: c.zIndex,
        renderOrder: c.renderOrder,
        bounds: c.bounds,
      })),
      chosenImageId: snapshot.chosenImageId,
      chosenBounds: snapshot.chosenBounds,
      chosenAtDownImageId: snapshot.chosenAtDownImageId,
      tapMoveThresholdPx: snapshot.tapMoveThresholdPx,
      tapMaxDurationMs: snapshot.tapMaxDurationMs,
      panStartThresholdPx: snapshot.panStartThresholdPx,
    };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.detachWheel?.();
    this.gesture?.destroy();
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true });
    }
  }
}

export type { PlacedImage };
