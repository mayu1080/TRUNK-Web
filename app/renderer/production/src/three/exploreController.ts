import * as THREE from 'three';
import { loadContentCards } from '../contentCards';
import { listConfig } from '../listConfig';
import {
  getVisualPreset,
  MAX_TEXTURE_EDGE,
  onRuntimeConfigChange,
  runtimeConfig,
} from '../runtimeConfig';
import type {
  BubbleRuntimeState,
  CardGenerationMode,
  ContentLoadStatus,
  DemoListCard,
  DollyInputSource,
  DollyWheelMode,
  FileProtocolTextureLoadResult,
  ImageZoomLoadStatus,
  ListDebugStats,
  ListGestureMode,
  SelectedDemoCard,
} from '../types';
import { attachBubbleRevealShader, createRevealUniforms, type RevealUniforms } from './bubbleRevealShader';
import { FpsCounter } from './fpsCounter';
import { createPlaceholderCanvas } from './placeholderCards';
import {
  buildScenePlacements,
  CAMERA_CONFIG,
  CARD_MOTION,
  CARD_SCALE_RANGE,
  DOLLY_CRUISE,
  resolveListWorld,
  SCENE_LAYOUT,
  wrapCentered,
  wrapDelta,
  type ListWorld,
} from './sceneLayout';
import {
  BUBBLE_ACTION_DEBUG_RING,
  CAMERA_PAN_DEBUG_RING,
  decideOneFingerPanMove,
  eventBelongsToWindow,
  formatBubbleActionDebugSample,
  formatCameraPanDebugSample,
  isDuplicateLocalPointerDown,
  localBubbleFingerGate,
  type BubbleActionDebugSample,
  type BubbleActionReason,
  type CameraPanDebugSample,
  type CameraUpdateReason,
} from '@trunk-shared/localGestureSession';
import { describeEventTarget, getInputTraceRows, observeAllMoves, pushInputTrace, rowFromPointer } from '../inputTrace';

const CARD_LONG_SIDE = 280;
const TEXTURE_LOAD_CONCURRENCY = 4;
const CAMERA_Z_EPS = 1.5;
const FPS_LOG_MS = 2000;
const TWO_FINGER_VERTICAL_DEAD_ZONE_PX = listConfig.twoFingerVerticalDeadZonePx;
const TWO_FINGER_PINCH_DEAD_ZONE_PX = listConfig.twoFingerPinchDeadZonePx;

export interface ExploreViewLayout {
  monitorId: number;
  viewportOffsetX: number;
  viewportOffsetY: number;
  scale: number;
  orientation: 'portrait' | 'landscape';
  width: number;
  height: number;
}

export interface ExploreControllerCallbacks {
  onStats(stats: ListDebugStats): void;
  onReady(): void;
  onCardTap(card: SelectedDemoCard): void;
  onValidActivity?(): void;
}

interface PointerState {
  id: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startTime: number;
  dragging: boolean;
  sessionId: number;
  ownerMonitorId: number;
  ownerWindowId: number | null;
  ownerDisplayId: number | null;
  pointerType: string;
}

interface ListCard {
  meta: DemoListCard;
  sceneX: number;
  sceneY: number;
  sceneZ: number;
  mesh: THREE.Mesh;
  texture: THREE.Texture;
  usesSharedTexture: boolean;
  scaleMul: number;
  driftMul: number;
  idleIntensity: number;
  idleSpeed: number;
  idlePhaseX: number;
  idlePhaseY: number;
  idlePhaseRot: number;
  appearT: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function urlScheme(url: string | null | undefined): string {
  if (!url) return 'none';
  try {
    return new URL(url).protocol.replace(/:$/, '');
  } catch {
    if (url.startsWith('file:')) return 'file';
    const idx = url.indexOf('://');
    return idx > 0 ? url.slice(0, idx) : 'unknown';
  }
}

function planeSizeForAspect(aspect: number, scaleMul: number): { width: number; height: number } {
  const longSide = CARD_LONG_SIDE * scaleMul;
  const width = aspect >= 1 ? longSide : longSide * aspect;
  const height = aspect >= 1 ? longSide / aspect : longSide;
  return { width, height };
}

/** Phase 7.1: LIST world は monitor の実表示 aspect から作る。monitor-layout の offset は使わない。 */
function buildListWorld(monitorId: number, aspect: number): ListWorld {
  return resolveListWorld({
    mode: listConfig.listWorldMode === 'sharedWall' ? 'sharedWall' : 'independent',
    monitorId,
    aspect,
    baseSeed: listConfig.cardExpandSeed,
    seedStride: listConfig.worldSeedStride,
    multiplierX: listConfig.worldScaleMultiplierX,
    multiplierY: listConfig.worldScaleMultiplierY,
    referenceDistance: listConfig.worldReferenceDistance,
    spawnSpanMultiplier: listConfig.cardSpawnSpanMultiplier,
  });
}

function capTextureImage(texture: THREE.Texture, maxEdge: number): void {
  const img = texture.image as { width?: number; height?: number } | undefined;
  const iw = img?.width || 0;
  const ih = img?.height || 0;
  if (!img || !iw || !ih || Math.max(iw, ih) <= maxEdge) return;
  const scale = maxEdge / Math.max(iw, ih);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(iw * scale));
  canvas.height = Math.max(1, Math.round(ih * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(img as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  texture.image = canvas;
  texture.needsUpdate = true;
}

export class ExploreController {
  private host!: HTMLElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private cards: ListCard[] = [];
  private imageMeshes: THREE.Object3D[] = [];
  private raycaster = new THREE.Raycaster();
  private pointerNdc = new THREE.Vector2();
  private fpsCounter = new FpsCounter();
  private raf = 0;
  private destroyed = false;
  private interactionEnabled = true;
  private pointers = new Map<number, PointerState>();
  private resizeObserver: ResizeObserver | null = null;
  private lastFrameMs = performance.now();
  private lastStatsEmitMs = 0;
  private lastFpsLogMs = 0;
  private currentFps = 0;
  private drawingSize = new THREE.Vector2();
  private unsubRuntime: (() => void) | null = null;
  private clockTime = 0;

  private cameraX = CAMERA_CONFIG.initialX;
  private cameraY = CAMERA_CONFIG.initialY;
  private cameraZ = CAMERA_CONFIG.initialZ;
  private targetCameraX = CAMERA_CONFIG.initialX;
  private targetCameraY = CAMERA_CONFIG.initialY;
  private targetCameraZ = CAMERA_CONFIG.initialZ;
  private panMinX = CAMERA_CONFIG.minX;
  private panMaxX = CAMERA_CONFIG.maxX;
  private panMinY = CAMERA_CONFIG.minY;
  private panMaxY = CAMERA_CONFIG.maxY;

  private revealUniforms: RevealUniforms = createRevealUniforms();
  private bubbleVisible = false;
  private bubbleScreenX = 0;
  private bubbleScreenY = 0;
  private bubbleTargetX = 0;
  private bubbleTargetY = 0;
  private bubbleHasTarget = false;
  private bubblePointerType = 'none';
  private bubbleContactActive = false;
  private hideBubbleTimer: ReturnType<typeof setTimeout> | null = null;
  private revealCenterNdcX = 0;
  private revealCenterNdcY = 0;
  private revealActive = false;

  private selectedInstanceId: string | null = null;
  private selectedSourceImageId: string | null = null;
  private selectedDisplayIndex: number | null = null;
  private selectedImageUrl: string | null = null;
  private selectedRelativePath: string | null = null;
  private selectedTitle: string | null = null;
  private selectedCategoryId: string | null = null;
  private lastChosenId: string | null = null;
  private lastRaycastCandidates = 0;

  private realImageCount = 0;
  private sourceImageCount = 0;
  private duplicatedCount = 0;
  private textureLoadedCount = 0;
  private textureFailedCount = 0;
  private contentLoadStatus: ContentLoadStatus = 'idle';
  private firstImageUrlScheme = 'none';
  private fileProtocolTextureLoadResult: FileProtocolTextureLoadResult = 'pending';
  private cardGenerationMode: CardGenerationMode = 'fallback-placeholder';
  private contentError: string | null = null;
  private exploreSource: 'listImages' | 'recursive-images' | 'none' = 'none';
  private contentRoot: string | null = null;
  private firstImageUrl: string | null = null;
  private wrapCount = 0;
  private panWrapCountX = 0;
  private panWrapCountY = 0;
  private world: ListWorld;
  private cruiseVelocityZ = 0;
  private shiftHeld = false;
  private targetFov = CAMERA_CONFIG.fov;
  private lastDollyImpulse = 0;
  private wheelMode: DollyWheelMode = 'normal';
  private lastDollyInput: DollyInputSource = 'none';
  private pinchActive = false;
  private pinchSession = false;
  private tapSuppressedByPinch = false;
  private pinchDistance = 0;
  private pinchDelta = 0;
  private pinchCentroidY = 0;
  private pinchOriginCentroidY = 0;
  private pinchOriginDistance = 0;
  private gestureMode: ListGestureMode = 'idle';
  private twoFingerVerticalArmed = false;
  private twoFingerDollyActive = false;
  private twoFingerDollyDeltaY = 0;
  private twoFingerDollyTotalY = 0;
  private tapSuppressedByTwoFinger = false;
  private tapSuppressedByMultiTouch = false;
  /** TouchEvent.touches.length — Windows may omit 2nd/3rd PointerEvents. */
  private nativeTouchCount = 0;
  private lastPointerType = 'none';
  private lastTouchMonitorId: number | null = null;
  /** Local to this BrowserWindow. Camera pan is gated on this session, not global activity. */
  private interactionSessionId = 0;
  private ownerWindowId: number | null = null;
  private ownerDisplayId: number | null = null;
  private cameraPanDebug: CameraPanDebugSample[] = [];
  private bubbleActionDebug: BubbleActionDebugSample[] = [];
  private lastCameraUpdateReason: CameraUpdateReason | 'none' = 'none';
  private textureOkByScheme = { file: 0, custom: 0, other: 0 };
  private textureFailByScheme = { file: 0, custom: 0, other: 0 };
  private sharedTextures = new Map<string, THREE.Texture>();
  private projectScratch = new THREE.Vector3();
  private overlayOpen = false;
  private imageZoomLoadStatus: ImageZoomLoadStatus = 'idle';
  private contextLost = false;

  constructor(
    private callbacks: ExploreControllerCallbacks,
    private layout: ExploreViewLayout,
  ) {
    this.world = buildListWorld(layout.monitorId, layout.width / Math.max(layout.height, 1));
  }

  private applyLayoutOrigin(): void {
    const scale = this.layout.scale > 0 ? this.layout.scale : 1;
    if (this.world.mode === 'independent') {
      // Phase 7.1: 4面1世界の viewportOffset は使わない。原点はこの monitor の world 中心。
      this.panMinX = -this.world.width / 2;
      this.panMaxX = this.world.width / 2;
      this.panMinY = -this.world.height / 2;
      this.panMaxY = this.world.height / 2;
      this.targetCameraX = CAMERA_CONFIG.initialX;
      this.targetCameraY = CAMERA_CONFIG.initialY;
    } else {
      this.panMinX = CAMERA_CONFIG.minX + this.layout.viewportOffsetX;
      this.panMaxX = CAMERA_CONFIG.maxX + this.layout.viewportOffsetX;
      this.panMinY = CAMERA_CONFIG.minY + this.layout.viewportOffsetY;
      this.panMaxY = CAMERA_CONFIG.maxY + this.layout.viewportOffsetY;
      this.targetCameraX = CAMERA_CONFIG.initialX + this.layout.viewportOffsetX;
      this.targetCameraY = CAMERA_CONFIG.initialY + this.layout.viewportOffsetY;
    }
    this.targetCameraZ = CAMERA_CONFIG.initialZ / scale;
    this.cameraX = this.targetCameraX;
    this.cameraY = this.targetCameraY;
    this.cameraZ = this.targetCameraZ;
  }

  getContentLoadStatus(): ContentLoadStatus {
    return this.contentLoadStatus;
  }

  async init(host: HTMLElement): Promise<void> {
    try {
      await this.initInner(host);
    } catch (err) {
      console.error('[production] explore init failed', err);
      this.contentLoadStatus = 'error';
      this.contentError = err instanceof Error ? err.message : String(err);
      try {
        this.emitStats(true);
      } catch {
        /* renderer may be incomplete */
      }
    }
  }

  private async initInner(host: HTMLElement): Promise<void> {
    this.host = host;
    const width = host.clientWidth || window.innerWidth || 1;
    const height = host.clientHeight || window.innerHeight || 1;
    // world はこの window の実表示比から作り、resize では作り直さない（カード配置を起動中固定にするため）。
    this.world = buildListWorld(this.layout.monitorId, width / height);
    this.applyLayoutOrigin();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, runtimeConfig.rendererPixelRatioMax);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.renderer.setClearColor(0x0a0a0a, 1);
    this.renderer.domElement.className = 'three-canvas';
    this.renderer.domElement.style.touchAction = 'none';
    host.appendChild(this.renderer.domElement);

    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a0a0a, CAMERA_CONFIG.fogDensity);

    this.camera = new THREE.PerspectiveCamera(
      CAMERA_CONFIG.fov,
      width / height,
      CAMERA_CONFIG.near,
      CAMERA_CONFIG.far,
    );
    this.applyCameraPose(true);
    this.syncRevealResolution();

    this.applyRuntimeVisual();
    this.unsubRuntime = onRuntimeConfigChange(() => this.applyRuntimeConfig());

    void window.trunkApi?.logEvent?.({
      level: 'info',
      message: 'production list world',
      context: {
        phase: 7.1,
        monitorId: this.layout.monitorId,
        listWorldMode: this.world.mode,
        seed: this.world.seed,
        worldWidth: Math.round(this.world.width),
        worldHeight: Math.round(this.world.height),
        viewportWorldWidth: Math.round(this.world.viewportWidth),
        viewportWorldHeight: Math.round(this.world.viewportHeight),
        canvasCssWidth: width,
        canvasCssHeight: height,
        windowInnerWidth: window.innerWidth,
        windowInnerHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
        targetCardCount: listConfig.targetCardCount,
      },
    });

    this.contentLoadStatus = 'loading';
    const loaded = await loadContentCards(this.world.seed);
    if (this.destroyed) return;

    this.realImageCount = loaded.realImageCount;
    this.sourceImageCount = loaded.sourceImageCount;
    this.duplicatedCount = loaded.duplicatedCount;
    this.cardGenerationMode = loaded.cardGenerationMode;
    this.firstImageUrlScheme = loaded.firstImageUrlScheme;
    this.firstImageUrl = loaded.firstImageUrl;
    this.exploreSource = loaded.exploreSource;
    this.contentError = loaded.contentError;
    this.contentLoadStatus = loaded.cardGenerationMode === 'fallback-placeholder' ? 'fallback' : 'loading';
    try {
      const config = await window.trunkApi?.getConfig?.();
      this.contentRoot = config?.contentRoot ?? null;
      this.ownerWindowId = config?.windowId ?? this.ownerWindowId;
      this.ownerDisplayId = config?.displayId ?? this.ownerDisplayId;
    } catch {
      this.contentRoot = null;
    }

    this.buildCards(loaded.cards);
    this.applyRuntimeVisual();
    this.emitStats(true);

    this.bindPointer();
    this.bindWheel();
    this.bindShiftKeys();
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(host);

    this.lastFrameMs = performance.now();
    const tick = () => {
      if (this.destroyed) return;
      this.raf = requestAnimationFrame(tick);
      const now = performance.now();
      const deltaTime = Math.min((now - this.lastFrameMs) / 1000, 0.05);
      this.lastFrameMs = now;
      this.clockTime += deltaTime;
      this.currentFps = this.fpsCounter.tick();
      this.updateCameraSmoothing(deltaTime);
      this.updateCardMotion(deltaTime);
      this.updateBubbleFollow();
      this.applyRevealUniforms();
      this.renderer.render(this.scene, this.camera);
      this.publishDebugSample();
      this.emitStats();
    };
    this.raf = requestAnimationFrame(tick);
    this.callbacks.onReady();

    if (loaded.cardGenerationMode !== 'fallback-placeholder') {
      await this.loadTextures(loaded.cards);
    } else {
      this.fileProtocolTextureLoadResult = 'not-attempted';
      this.contentLoadStatus = 'error';
      this.emitStats(true);
    }
  }

  private buildCards(metas: DemoListCard[]): void {
    const placements = buildScenePlacements(
      metas.length,
      this.world.seed,
      this.world.mode === 'independent'
        ? { spanX: this.world.spawnSpanX, spanY: this.world.spawnSpanY }
        : undefined,
    );
    for (let i = 0; i < metas.length; i++) {
      const meta = metas[i]!;
      const place = placements[i]!;
      const canvas = createPlaceholderCanvas(meta);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.needsUpdate = true;

      const aspect = canvas.width / canvas.height;
      const { width, height } = planeSizeForAspect(aspect, place.scaleMul);

      const preset = getVisualPreset();
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        color: preset.tintHex,
        transparent: true,
        opacity: 1,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: true,
      });
      attachBubbleRevealShader(material, this.revealUniforms);

      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
      mesh.position.set(place.sceneX, place.sceneY, place.sceneZ);
      mesh.rotation.set(0, 0, 0);
      mesh.userData = {
        instanceId: meta.instanceId,
        sourceImageId: meta.sourceImageId,
        displayIndex: meta.displayIndex,
        imageUrl: meta.imageUrl,
        relativePath: meta.relativePath,
        title: meta.title,
        categoryId: meta.categoryId,
        currentAlpha: 1,
        isImageCard: true,
      };
      this.scene.add(mesh);
      this.imageMeshes.push(mesh);
      this.cards.push({
        meta,
        sceneX: place.sceneX,
        sceneY: place.sceneY,
        sceneZ: place.sceneZ,
        mesh,
        texture,
        usesSharedTexture: false,
        scaleMul: place.scaleMul,
        driftMul: 1 + (Math.random() * 2 - 1) * CARD_MOTION.sceneDriftVariance,
        idleIntensity: 0.25 + Math.random() * 0.75,
        idleSpeed: lerp(CARD_MOTION.idleSpeedMin, CARD_MOTION.idleSpeedMax, Math.random()),
        idlePhaseX: Math.random() * Math.PI * 2,
        idlePhaseY: Math.random() * Math.PI * 2,
        idlePhaseRot: Math.random() * Math.PI * 2,
        appearT: 1,
      });
    }
  }

  private async loadTextures(metas: DemoListCard[]): Promise<void> {
    const loader = new THREE.TextureLoader();
    const unique = new Map<string, DemoListCard>();
    for (const meta of metas) {
      if (meta.imageUrl && !unique.has(meta.sourceImageId)) unique.set(meta.sourceImageId, meta);
    }

    const jobs = [...unique.values()];
    for (let i = 0; i < jobs.length; i += TEXTURE_LOAD_CONCURRENCY) {
      if (this.destroyed) return;
      const batch = jobs.slice(i, i + TEXTURE_LOAD_CONCURRENCY);
      await Promise.all(batch.map((meta) => this.loadOneSourceTexture(loader, meta)));
    }

    if (this.destroyed) return;

    for (const card of this.cards) {
      const shared = this.sharedTextures.get(card.meta.sourceImageId);
      if (!shared) {
        this.textureFailedCount += 1;
        continue;
      }
      this.applySharedTexture(card, shared);
      this.textureLoadedCount += 1;
    }

    this.fileProtocolTextureLoadResult = this.classifyTextureResult();
    this.contentLoadStatus =
      this.textureLoadedCount === 0 && this.realImageCount > 0 ? 'error' : 'loaded';
    this.emitStats(true);

    if (this.textureLoadedCount === 0 && this.realImageCount > 0) {
      this.contentError = `TextureLoader failed for all ${this.realImageCount} source images (scheme=${this.firstImageUrlScheme})`;
      console.error('[production]', this.contentError);
    }

    void window.trunkApi?.logEvent?.({
      level: this.textureLoadedCount > 0 ? 'info' : 'warn',
      message: 'production content textures',
      context: {
        phase: 3,
        realImageCount: this.realImageCount,
        displayedImageCount: this.cards.length,
        duplicatedCount: this.duplicatedCount,
        textureLoadedCount: this.textureLoadedCount,
        textureFailedCount: this.textureFailedCount,
        scheme: this.firstImageUrlScheme,
        result: this.fileProtocolTextureLoadResult,
      },
    });
  }

  private async loadOneSourceTexture(loader: THREE.TextureLoader, meta: DemoListCard): Promise<void> {
    const scheme = urlScheme(meta.imageUrl);
    try {
      const texture = await this.loadTextureWithFallback(loader, meta.imageUrl);
      if (this.destroyed) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      capTextureImage(texture, MAX_TEXTURE_EDGE);
      texture.needsUpdate = true;
      this.sharedTextures.set(meta.sourceImageId, texture);
      this.bumpSchemeCount(scheme, true);
    } catch (err) {
      this.bumpSchemeCount(scheme, false);
      console.error('[production] texture load failed', {
        sourceImageId: meta.sourceImageId,
        relativePath: meta.relativePath,
        imageUrl: meta.imageUrl,
        scheme,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async loadTextureWithFallback(loader: THREE.TextureLoader, url: string): Promise<THREE.Texture> {
    try {
      return await loader.loadAsync(url);
    } catch (loaderErr) {
      const loaderMessage = loaderErr instanceof Error ? loaderErr.message : String(loaderErr);
      console.warn('[production] TextureLoader failed, retrying with Image()', { url, error: loaderMessage });
      try {
        return await this.loadTextureViaImage(url);
      } catch (imageErr) {
        const imageMessage = imageErr instanceof Error ? imageErr.message : String(imageErr);
        throw new Error(`TextureLoader: ${loaderMessage}; Image(): ${imageMessage}; url=${url}`);
      }
    }
  }

  private loadTextureViaImage(url: string): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const texture = new THREE.Texture(image);
        texture.needsUpdate = true;
        resolve(texture);
      };
      image.onerror = () => {
        reject(new Error(`HTML Image failed to load`));
      };
      image.src = url;
    });
  }

  private applySharedTexture(card: ListCard, texture: THREE.Texture): void {
    const mat = card.mesh.material as THREE.MeshBasicMaterial;
    if (!card.usesSharedTexture) {
      card.texture.dispose();
    }
    card.texture = texture;
    card.usesSharedTexture = true;
    mat.map = texture;
    mat.needsUpdate = true;

    const img = texture.image as { width?: number; height?: number };
    const iw = img.width || 512;
    const ih = img.height || 512;
    const aspect = iw / Math.max(ih, 1);
    const { width, height } = planeSizeForAspect(aspect, card.scaleMul);
    card.mesh.geometry.dispose();
    card.mesh.geometry = new THREE.PlaneGeometry(width, height);
  }

  private bumpSchemeCount(scheme: string, ok: boolean): void {
    const bucket = scheme === 'file' ? 'file' : scheme === 'trunk-content' ? 'custom' : 'other';
    if (ok) this.textureOkByScheme[bucket] += 1;
    else this.textureFailByScheme[bucket] += 1;
  }

  private classifyTextureResult(): FileProtocolTextureLoadResult {
    const { file: fileOk, custom: customOk, other: otherOk } = this.textureOkByScheme;
    const { file: fileFail, custom: customFail, other: otherFail } = this.textureFailByScheme;
    const anyOk = fileOk + customOk + otherOk > 0;
    const anyFail = fileFail + customFail + otherFail > 0;
    if (!anyOk && !anyFail) return 'not-attempted';
    if (anyOk && anyFail) return 'mixed';
    if (fileOk > 0 && !anyFail) return 'file-ok';
    if (fileFail > 0 && !anyOk) return 'file-failed';
    if (customOk > 0 && !anyFail) return 'custom-protocol-ok';
    if (customFail > 0 && !anyOk) return 'custom-protocol-failed';
    return anyOk ? 'custom-protocol-ok' : 'custom-protocol-failed';
  }

  private updateCardMotion(deltaTime: number): void {
    const cam = CARD_MOTION;
    const speed = runtimeConfig.listMotionSpeed;
    const wrapWorld = this.world.mode === 'independent';

    for (const card of this.cards) {
      card.sceneZ += cam.sceneDriftSpeed * card.driftMul * speed * deltaTime;
      let dist = this.cameraZ - card.sceneZ;

      if (dist < cam.nearFadeEndDist) {
        card.sceneZ = this.cameraZ - cam.farAlphaSoftDist + Math.random() * 400;
        this.respawnCardXY(card);
        card.appearT = 0;
        dist = this.cameraZ - card.sceneZ;
      } else if (dist > cam.farFadeEndDist) {
        card.sceneZ = this.cameraZ - lerp(cam.nearFadeStartDist + 40, cam.farAlphaStartDist * 0.55, Math.random());
        this.respawnCardXY(card);
        card.appearT = 0;
        dist = this.cameraZ - card.sceneZ;
      } else if (wrapWorld && this.isCardOutOfSpawnBand(card)) {
        // pan で置いていったカードを画面外で出現帯へ戻す。端付近でも空白にならない。
        this.respawnCardXY(card);
        card.appearT = 0;
      }

      const t = this.clockTime * card.idleSpeed * speed;
      const yAmp = lerp(cam.idleYAmpMin, cam.idleYAmpMax, card.idleIntensity);
      const xAmp = lerp(cam.idleXAmpMin, cam.idleXAmpMax, card.idleIntensity);
      const rotAmp = ((cam.idleRotAmpDeg * Math.PI) / 180) * card.idleIntensity;
      // torus: カメラから見て最も近い複製位置に描く。世界の端が見た目のつなぎ目にならない。
      const renderX = wrapWorld
        ? this.cameraX + wrapDelta(this.cameraX, card.sceneX, this.world.width)
        : card.sceneX;
      const renderY = wrapWorld
        ? this.cameraY + wrapDelta(this.cameraY, card.sceneY, this.world.height)
        : card.sceneY;
      card.mesh.position.set(
        renderX + Math.sin(t * 0.71 + card.idlePhaseX) * xAmp,
        renderY + Math.sin(t + card.idlePhaseY) * yAmp,
        card.sceneZ,
      );
      card.mesh.rotation.set(0, 0, Math.sin(t * 0.61 + card.idlePhaseRot) * rotAmp);

      const appearStep = cam.appearFadeMs > 0 ? deltaTime / (cam.appearFadeMs / 1000) : 1;
      card.appearT = Math.min(1, card.appearT + appearStep);
      const nearFade =
        dist >= cam.nearFadeStartDist
          ? 1
          : dist <= cam.nearFadeEndDist
            ? 0
            : (dist - cam.nearFadeEndDist) / (cam.nearFadeStartDist - cam.nearFadeEndDist);
      let worldScale = cam.maxScaleClamp;
      if (cam.maxApparentScaleDist > 0 && dist > 0 && dist < cam.maxApparentScaleDist) {
        worldScale = Math.min(cam.maxScaleClamp, dist / cam.maxApparentScaleDist);
      }
      let depthAlpha = 1;
      if (dist > cam.farAlphaStartDist) {
        depthAlpha = lerp(1, cam.farAlphaFloor, smoothstep(cam.farAlphaStartDist, cam.farAlphaSoftDist, dist));
      }
      const alpha = depthAlpha * nearFade * card.appearT;
      const mat = card.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = alpha;
      card.mesh.userData.currentAlpha = alpha;
      card.mesh.userData.nearFadeAlpha = nearFade;
      card.mesh.scale.set(worldScale, worldScale, 1);
      card.mesh.visible = alpha > 0.02;
    }
  }

  private applyCameraPose(immediate = false): void {
    if (immediate) {
      this.cameraX = this.targetCameraX;
      this.cameraY = this.targetCameraY;
      this.cameraZ = this.targetCameraZ;
    }
    this.camera.position.set(this.cameraX, this.cameraY, this.cameraZ);
    this.camera.lookAt(this.cameraX, this.cameraY, this.cameraZ - 1000);
  }

  private updateCameraSmoothing(deltaTime: number): void {
    this.updateDollyMotion(deltaTime);

    const cruising = Math.abs(this.cruiseVelocityZ) > DOLLY_CRUISE.activeSpeed;
    const idleSmoothing = clamp(CAMERA_CONFIG.smoothing * listConfig.cameraSmoothing, 0.02, 1);
    const s = cruising ? clamp(runtimeConfig.dollyPoseSmoothing, 0.02, 1) : idleSmoothing;
    this.cameraX = lerp(this.cameraX, this.targetCameraX, s);
    this.cameraY = lerp(this.cameraY, this.targetCameraY, s);
    this.cameraZ = lerp(this.cameraZ, this.targetCameraZ, s);

    const speedT = clamp(Math.abs(this.cruiseVelocityZ) / DOLLY_CRUISE.maxSpeed, 0, 1);
    this.targetFov = CAMERA_CONFIG.fov + DOLLY_CRUISE.fovWidenAtFullSpeed * speedT;
    if (this.camera && Math.abs(this.camera.fov - this.targetFov) > 0.01) {
      this.camera.fov = lerp(this.camera.fov, this.targetFov, DOLLY_CRUISE.fovSmoothing);
      this.camera.updateProjectionMatrix();
    }

    this.applyCameraPose(false);
  }

  /**
   * Shift+wheel / pinch / 2本指縦 共通の奥行きクルーズ。
   * 非 pinch: 負 delta（画面上方向 / Shift 上）= 潜る（forward）。
   */
  private applyDollyImpulse(deltaPx: number, source: Exclude<DollyInputSource, 'wheel' | 'none'>): void {
    if (!runtimeConfig.dollyCruiseEnabled) return;
    const direction: 1 | -1 = source === 'pinch' ? (deltaPx > 0 ? 1 : -1) : deltaPx < 0 ? 1 : -1;
    const magCap =
      source === 'two-finger-vertical' ? listConfig.twoFingerDollyMaxDeltaPx : DOLLY_CRUISE.impulseDeltaCapPx;
    const mag = Math.min(Math.abs(deltaPx), magCap);
    const scale =
      source === 'pinch'
        ? runtimeConfig.pinchDollyScale
        : source === 'two-finger-vertical'
          ? listConfig.twoFingerDollyScale
          : 1;
    const impulse = (mag / 100) * DOLLY_CRUISE.impulsePer100px * runtimeConfig.cameraDollySpeed * scale;
    this.cruiseVelocityZ += direction > 0 ? -impulse : impulse;
    this.cruiseVelocityZ = clamp(this.cruiseVelocityZ, -DOLLY_CRUISE.maxSpeed, DOLLY_CRUISE.maxSpeed);
    this.lastDollyImpulse = impulse;
    this.lastDollyInput = source;
    this.wheelMode = 'dolly-cruise';
  }

  private twoFingerInputHeld(): boolean {
    return this.pinchActive || this.twoFingerDollyActive;
  }

  private updateDollyMotion(deltaTime: number): void {
    const cfg = DOLLY_CRUISE;
    const inputHeld = this.shiftHeld || this.twoFingerInputHeld();
    const friction = inputHeld ? cfg.coastFriction : cfg.releaseBrake;
    this.cruiseVelocityZ *= Math.exp(-friction * deltaTime);

    if (Math.abs(this.cruiseVelocityZ) < cfg.deadZone) {
      this.cruiseVelocityZ = 0;
      return;
    }

    this.cruiseVelocityZ = clamp(this.cruiseVelocityZ, -cfg.maxSpeed, cfg.maxSpeed);
    this.targetCameraZ += this.cruiseVelocityZ * deltaTime;
    this.wrapDepthLoop();
  }

  private currentFriction(): number {
    return this.shiftHeld || this.twoFingerInputHeld() ? DOLLY_CRUISE.coastFriction : DOLLY_CRUISE.releaseBrake;
  }

  private currentPoseSmoothing(): number {
    const cruising = Math.abs(this.cruiseVelocityZ) > DOLLY_CRUISE.activeSpeed;
    if (cruising) return runtimeConfig.dollyPoseSmoothing;
    return clamp(CAMERA_CONFIG.smoothing * listConfig.cameraSmoothing, 0.02, 1);
  }

  private pinchDistanceBetween(): number {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0]!.lastX - pts[1]!.lastX, pts[0]!.lastY - pts[1]!.lastY);
  }

  private pinchCentroidYBetween(): number {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return 0;
    return (pts[0]!.lastY + pts[1]!.lastY) * 0.5;
  }

  private effectiveFingerCount(): number {
    return Math.max(this.pointers.size, this.nativeTouchCount);
  }

  private touchPointerCount(): number {
    let count = 0;
    for (const pointer of this.pointers.values()) {
      if (pointer.pointerType === 'touch') count += 1;
    }
    return count;
  }

  private isCameraPanDebugEnabled(): boolean {
    return typeof document !== 'undefined' && Boolean(document.querySelector('.app.debug-mode'));
  }

  private pointerEventBelongsHere(e: PointerEvent): boolean {
    const viewIsThisWindow = !e.view || e.view === window;
    return eventBelongsToWindow({
      viewIsThisWindow,
      clientX: e.clientX,
      clientY: e.clientY,
      viewportWidth: window.innerWidth || 1,
      viewportHeight: window.innerHeight || 1,
    });
  }

  private recordCameraPanDebug(
    e: PointerEvent,
    reason: CameraUpdateReason,
    previousX: number,
    previousY: number,
    deltaX: number,
    deltaY: number,
    beforeX: number,
    beforeY: number,
    afterX: number,
    afterY: number,
  ): void {
    this.lastCameraUpdateReason = reason;
    if (!this.isCameraPanDebugEnabled()) return;
    const sample: CameraPanDebugSample = {
      timestamp: Date.now(),
      windowId: this.ownerWindowId,
      monitorId: this.layout.monitorId,
      displayId: this.ownerDisplayId,
      sourceEventType: e.type,
      sourcePointerId: e.pointerId,
      sourcePointerType: e.pointerType || 'unknown',
      gestureMode: this.gestureMode,
      activePointerCount: this.pointers.size,
      clientX: e.clientX,
      clientY: e.clientY,
      previousX,
      previousY,
      deltaX,
      deltaY,
      cameraBeforeX: beforeX,
      cameraBeforeY: beforeY,
      cameraAfterX: afterX,
      cameraAfterY: afterY,
      cameraUpdateReason: reason,
      gestureSessionId: this.interactionSessionId,
    };
    this.cameraPanDebug = [...this.cameraPanDebug, sample].slice(-CAMERA_PAN_DEBUG_RING);
  }

  private recordBubbleAction(action: BubbleActionReason, clientX = this.bubbleTargetX, clientY = this.bubbleTargetY): void {
    if (!this.isCameraPanDebugEnabled()) return;
    const sample: BubbleActionDebugSample = {
      timestamp: Date.now(),
      monitorId: this.layout.monitorId,
      action,
      localFingerCount: this.effectiveFingerCount(),
      clientX,
      clientY,
    };
    this.bubbleActionDebug = [...this.bubbleActionDebug, sample].slice(-BUBBLE_ACTION_DEBUG_RING);
  }

  private toPointerRecord(p: PointerState) {
    return {
      id: p.id,
      startX: p.startX,
      startY: p.startY,
      lastX: p.lastX,
      lastY: p.lastY,
      sessionId: p.sessionId,
      ownerMonitorId: p.ownerMonitorId,
      ownerWindowId: p.ownerWindowId,
      ownerDisplayId: p.ownerDisplayId,
      pointerType: p.pointerType,
      dragging: p.dragging,
    };
  }

  private beginTwoFingerSessionIfNeeded(): void {
    if (this.effectiveFingerCount() < 2) return;
    if (this.gestureMode === 'multi-touch-blocked') return;
    if (
      this.gestureMode !== 'two-finger-pending' &&
      this.gestureMode !== 'two-finger-swipe-dolly' &&
      this.gestureMode !== 'two-finger-pinch-dolly'
    ) {
      if (this.pointers.size >= 2) {
        this.pinchDistance = this.pinchDistanceBetween();
        this.pinchDelta = 0;
        this.pinchCentroidY = this.pinchCentroidYBetween();
        this.pinchOriginCentroidY = this.pinchCentroidY;
        this.pinchOriginDistance = this.pinchDistance;
      }
      this.gestureMode = 'two-finger-pending';
      this.twoFingerVerticalArmed = false;
      this.twoFingerDollyActive = false;
      this.pinchActive = false;
      this.twoFingerDollyDeltaY = 0;
      this.twoFingerDollyTotalY = 0;
      this.hideBubbleForMultiTouch();
      this.callbacks.onValidActivity?.();
    }
    this.pinchSession = true;
    this.tapSuppressedByPinch = true;
    this.tapSuppressedByTwoFinger = true;
  }

  private enterMultiTouchBlocked(): void {
    this.gestureMode = 'multi-touch-blocked';
    this.pinchActive = false;
    this.twoFingerDollyActive = false;
    this.twoFingerVerticalArmed = false;
    this.pinchSession = true;
    this.tapSuppressedByPinch = true;
    this.tapSuppressedByTwoFinger = true;
    this.tapSuppressedByMultiTouch = true;
    this.hideBubbleForMultiTouch();
  }

  private hideBubbleForMultiTouch(): void {
    const wasVisible = this.bubbleVisible;
    this.bubbleVisible = false;
    this.revealActive = false;
    this.bubbleHasTarget = false;
    this.bubbleContactActive = false;
    if (this.hideBubbleTimer) {
      clearTimeout(this.hideBubbleTimer);
      this.hideBubbleTimer = null;
    }
    if (wasVisible) this.recordBubbleAction('hide-multi');
  }

  private resetPinchTracking(): void {
    this.pinchActive = false;
    this.pinchSession = false;
    this.tapSuppressedByPinch = false;
    this.tapSuppressedByTwoFinger = false;
    this.tapSuppressedByMultiTouch = false;
    this.pinchDistance = 0;
    this.pinchDelta = 0;
    this.pinchCentroidY = 0;
    this.pinchOriginCentroidY = 0;
    this.pinchOriginDistance = 0;
    this.gestureMode = 'idle';
    this.twoFingerVerticalArmed = false;
    this.twoFingerDollyActive = false;
    this.twoFingerDollyDeltaY = 0;
    this.twoFingerDollyTotalY = 0;
  }

  private sessionBlocksOneFinger(): boolean {
    return (
      this.pinchSession ||
      this.nativeTouchCount >= 2 ||
      this.effectiveFingerCount() >= 2 ||
      this.gestureMode === 'two-finger-pending' ||
      this.gestureMode === 'two-finger-swipe-dolly' ||
      this.gestureMode === 'two-finger-pinch-dolly' ||
      this.gestureMode === 'multi-touch-blocked'
    );
  }

  /** independent: 出現帯はカメラ基準で world 内に畳む。sharedWall: 旧 SCENE_LAYOUT 範囲。 */
  private respawnCardXY(card: ListCard): void {
    if (this.world.mode !== 'independent') {
      card.sceneX = lerp(SCENE_LAYOUT.xRange[0], SCENE_LAYOUT.xRange[1], Math.random());
      card.sceneY = lerp(SCENE_LAYOUT.yRange[0], SCENE_LAYOUT.yRange[1], Math.random());
      return;
    }
    card.sceneX = wrapCentered(
      this.cameraX + (Math.random() - 0.5) * this.world.spawnSpanX,
      this.world.width,
    );
    card.sceneY = wrapCentered(
      this.cameraY + (Math.random() - 0.5) * this.world.spawnSpanY,
      this.world.height,
    );
  }

  /** 出現帯の外（=画面外）かどうか。torus 差分で見るので端をまたいでも正しい。 */
  private isCardOutOfSpawnBand(card: ListCard): boolean {
    const dx = Math.abs(wrapDelta(this.cameraX, card.sceneX, this.world.width));
    const dy = Math.abs(wrapDelta(this.cameraY, card.sceneY, this.world.height));
    return dx > this.world.spawnSpanX * 0.75 || dy > this.world.spawnSpanY * 0.75;
  }

  /**
   * 上下左右 wrap。camera と target を同じ量ずらすので lerp が世界を横断しない。
   * 端で止めず、逆側の世界へ連続して回り込む。
   */
  private wrapPanLoop(): void {
    const { width, height } = this.world;
    if (width > 0 && Math.abs(this.targetCameraX) > width / 2) {
      const shift = wrapCentered(this.targetCameraX, width) - this.targetCameraX;
      this.targetCameraX += shift;
      this.cameraX += shift;
      this.panWrapCountX += 1;
    }
    if (height > 0 && Math.abs(this.targetCameraY) > height / 2) {
      const shift = wrapCentered(this.targetCameraY, height) - this.targetCameraY;
      this.targetCameraY += shift;
      this.cameraY += shift;
      this.panWrapCountY += 1;
    }
  }

  /** Low-risk dolly wrap: shift camera + cards so wheel does not hard-stop at min/max Z. */
  private wrapDepthLoop(): void {
    const { minZ, maxZ } = CAMERA_CONFIG;
    const span = maxZ - minZ;
    if (span <= 0) return;
    let delta = 0;
    while (this.targetCameraZ < minZ) {
      this.targetCameraZ += span;
      delta += span;
    }
    while (this.targetCameraZ > maxZ) {
      this.targetCameraZ -= span;
      delta -= span;
    }
    if (delta === 0) return;
    this.wrapCount += 1;
    this.cameraZ += delta;
    for (const card of this.cards) {
      card.sceneZ += delta;
    }
  }

  getBubbleState(): BubbleRuntimeState {
    const allowed = this.isBubbleAllowed();
    const fingerGate = localBubbleFingerGate(this.effectiveFingerCount());
    const visible = this.bubbleVisible && allowed && fingerGate !== 'hide-multi';
    return {
      enabled: listConfig.bubbleEnabled,
      visible,
      allowed,
      screenX: this.bubbleScreenX,
      screenY: this.bubbleScreenY,
      sizePx: runtimeConfig.bubbleSizePx,
      revealRadiusPx: runtimeConfig.revealRadiusPx,
      pointerType: this.bubblePointerType,
      revealCenterNdcX: this.revealCenterNdcX,
      revealCenterNdcY: this.revealCenterNdcY,
      revealActive: this.revealActive && visible,
      bubbleMonitorId: this.layout.monitorId,
    };
  }

  private isBubbleAllowed(): boolean {
    return listConfig.bubbleEnabled && this.interactionEnabled && !this.overlayOpen;
  }

  private showBubbleAt(clientX: number, clientY: number, pointerType: string): void {
    if (!this.isBubbleAllowed()) return;
    if (localBubbleFingerGate(this.effectiveFingerCount()) !== 'show') return;
    if (this.hideBubbleTimer) {
      clearTimeout(this.hideBubbleTimer);
      this.hideBubbleTimer = null;
    }
    this.bubbleTargetX = clientX;
    this.bubbleTargetY = clientY;
    this.bubbleHasTarget = true;
    this.bubblePointerType = pointerType;
    const wasVisible = this.bubbleVisible;
    this.bubbleVisible = true;
    if (!wasVisible) this.recordBubbleAction('show-one-finger', clientX, clientY);
    if (!this.bubbleScreenX && !this.bubbleScreenY) {
      this.bubbleScreenX = clientX;
      this.bubbleScreenY = clientY;
    }
  }

  private scheduleHideBubble(): void {
    if (this.hideBubbleTimer) clearTimeout(this.hideBubbleTimer);
    this.hideBubbleTimer = setTimeout(() => {
      this.hideBubbleTimer = null;
      this.bubbleVisible = false;
      this.revealActive = false;
      this.bubbleContactActive = false;
      this.recordBubbleAction('hide-timer');
    }, listConfig.bubbleHideDelayMs);
  }

  private updateBubbleFromPointer(e: PointerEvent, opts: { show?: boolean; contact?: boolean } = {}): void {
    if (!this.isBubbleAllowed()) return;
    const gate = localBubbleFingerGate(this.effectiveFingerCount());
    if (gate === 'hide-multi') {
      this.hideBubbleForMultiTouch();
      return;
    }
    if (gate !== 'show') return;
    if (opts.show || this.bubbleVisible) {
      this.showBubbleAt(e.clientX, e.clientY, e.pointerType || 'mouse');
    }
    if (opts.contact) this.bubbleContactActive = true;
  }

  private updateBubbleFollow(): void {
    if (!this.bubbleHasTarget || !this.isBubbleAllowed()) {
      if (!this.isBubbleAllowed()) {
        if (this.bubbleVisible) this.recordBubbleAction('hide-disallowed');
        this.bubbleVisible = false;
        this.revealActive = false;
      }
      return;
    }
    const s = listConfig.bubbleFollowSmoothing;
    this.bubbleScreenX = lerp(this.bubbleScreenX, this.bubbleTargetX, s);
    this.bubbleScreenY = lerp(this.bubbleScreenY, this.bubbleTargetY, s);
  }

  private syncRevealResolution(): void {
    if (!this.renderer) return;
    const size = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(size);
    this.revealUniforms.uResolution.value.copy(size);
  }

  private applyRevealUniforms(): void {
    const active = this.isBubbleAllowed() && this.bubbleVisible && this.bubbleHasTarget;
    this.revealActive = active;
    this.revealUniforms.uRevealActive.value = active ? 1 : 0;
    const pr = this.renderer.getPixelRatio();
    this.revealUniforms.uRevealRadiusPx.value = runtimeConfig.revealRadiusPx * pr;
    if (!active) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndcX = ((this.bubbleScreenX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
    const ndcY = -((this.bubbleScreenY - rect.top) / Math.max(rect.height, 1)) * 2 + 1;
    this.revealCenterNdcX = ndcX;
    this.revealCenterNdcY = ndcY;
    this.revealUniforms.uRevealCenterNdc.value.set(ndcX, ndcY);
  }

  destroy(): void {
    try {
      this.destroyInner();
    } catch (err) {
      console.error('[production] explore destroy failed', err);
    }
  }

  private destroyInner(): void {
    this.destroyed = true;
    this.unsubRuntime?.();
    this.unsubRuntime = null;
    cancelAnimationFrame(this.raf);
    if (this.hideBubbleTimer) clearTimeout(this.hideBubbleTimer);
    this.resizeObserver?.disconnect();
    this.unbindPointer();
    this.unbindWheel();
    this.unbindShiftKeys();
    this.pointers.clear();
    this.nativeTouchCount = 0;
    this.resetPinchTracking();
    this.renderer?.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer?.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);
    for (const card of this.cards) {
      if (!card.usesSharedTexture) card.texture.dispose();
      card.mesh.geometry.dispose();
      (card.mesh.material as THREE.Material).dispose();
      this.scene?.remove(card.mesh);
    }
    for (const texture of this.sharedTextures.values()) {
      texture.dispose();
    }
    this.sharedTextures.clear();
    this.cards = [];
    this.imageMeshes = [];
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }

  private handleResize(): void {
    if (!this.host || !this.renderer || !this.camera) return;
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, runtimeConfig.rendererPixelRatioMax));
    this.renderer.setSize(w, h, false);
    this.syncRevealResolution();
  }

  private bindPointer(): void {
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointercancel', this.onPointerCancel);
    el.addEventListener('lostpointercapture', this.onLostPointerCapture);
    el.addEventListener('gotpointercapture', this.onGotPointerCapture);
    el.addEventListener('pointerleave', this.onPointerLeave);
    const touchOpts: AddEventListenerOptions = { passive: false, capture: true };
    window.addEventListener('touchstart', this.onNativeTouchChange, touchOpts);
    window.addEventListener('touchmove', this.onNativeTouchChange, touchOpts);
    window.addEventListener('touchend', this.onNativeTouchChange, touchOpts);
    window.addEventListener('touchcancel', this.onNativeTouchChange, touchOpts);
  }

  private unbindPointer(): void {
    const el = this.renderer?.domElement;
    if (!el) return;
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('pointercancel', this.onPointerCancel);
    el.removeEventListener('lostpointercapture', this.onLostPointerCapture);
    el.removeEventListener('gotpointercapture', this.onGotPointerCapture);
    el.removeEventListener('pointerleave', this.onPointerLeave);
    window.removeEventListener('touchstart', this.onNativeTouchChange, true);
    window.removeEventListener('touchmove', this.onNativeTouchChange, true);
    window.removeEventListener('touchend', this.onNativeTouchChange, true);
    window.removeEventListener('touchcancel', this.onNativeTouchChange, true);
  }

  private bindWheel(): void {
    this.renderer.domElement.addEventListener('wheel', this.onWheel, { passive: false });
  }

  private unbindWheel(): void {
    this.renderer?.domElement.removeEventListener('wheel', this.onWheel);
  }

  private bindShiftKeys(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
  }

  private unbindShiftKeys(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Shift') this.shiftHeld = true;
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.key === 'Shift') this.shiftHeld = false;
  };

  private onWindowBlur = (): void => {
    this.shiftHeld = false;
    pushInputTrace({
      monitorId: this.layout.monitorId,
      windowId: this.ownerWindowId,
      eventType: 'blur',
      decision: 'INFO',
      pointerId: null,
      pointerType: 'none',
      isPrimary: null,
      clientX: null,
      clientY: null,
      screenX: null,
      screenY: null,
      buttons: null,
      target: 'window',
      cancelable: null,
      defaultPrevented: null,
      capture: null,
      nativeTouchCount: this.nativeTouchCount,
      pointerCount: this.pointers.size,
      activePointerCount: this.pointers.size,
      activeTouchPointerCount: this.touchPointerCount(),
      gestureMode: this.gestureMode,
      interactionSessionId: this.interactionSessionId,
      interactionLocked: !this.interactionEnabled,
      extra: 'keepTouchPointers',
    });
    // Keep local touch sessions. Focus moving to another monitor must not
    // clear lastX/startX — a leftover pointermove at the original down point
    // would snap camera XY back toward the first contact.
    for (const [id, p] of [...this.pointers.entries()]) {
      if (p.pointerType !== 'touch') this.pointers.delete(id);
    }
    if (this.pointers.size === 0 && this.nativeTouchCount === 0) {
      this.resetPinchTracking();
      this.bubbleContactActive = false;
    }
  };

  private onNativeTouchChange = (e: TouchEvent): void => {
    const target = e.target;
    if (target instanceof Element && target.closest('.debug-panel, .debug-toggle, .topbar')) {
      return;
    }
    this.nativeTouchCount = e.touches.length;
    this.lastPointerType = 'touch';
    this.lastTouchMonitorId = this.layout.monitorId;
    const touch = e.changedTouches[0];
    if (e.type !== 'touchmove') {
      pushInputTrace({
        monitorId: this.layout.monitorId,
        windowId: this.ownerWindowId,
        eventType: e.type,
        decision: e.touches.length >= 3 ? 'DROP_MULTI_TOUCH_BLOCKED' : 'INFO',
        pointerId: touch?.identifier ?? null,
        pointerType: 'touch',
        isPrimary: null,
        clientX: touch?.clientX ?? null,
        clientY: touch?.clientY ?? null,
        screenX: touch?.screenX ?? null,
        screenY: touch?.screenY ?? null,
        buttons: null,
        target: describeEventTarget(e.target),
        cancelable: e.cancelable,
        defaultPrevented: e.defaultPrevented,
        capture: true,
        nativeTouchCount: e.touches.length,
        pointerCount: this.pointers.size,
        touchIdentifier: touch?.identifier ?? null,
        touchesLength: e.touches.length,
        changedTouchesLength: e.changedTouches.length,
        activePointerCount: this.pointers.size,
        activeTouchPointerCount: this.touchPointerCount(),
        gestureMode: this.gestureMode,
        interactionSessionId: this.interactionSessionId,
        interactionLocked: !this.interactionEnabled,
        extra: `changed=${e.changedTouches.length} prevent=${e.type === 'touchmove' && e.touches.length >= 2}`,
      });
    }
    const fingers = this.effectiveFingerCount();
    if (e.touches.length >= 3 || fingers >= 3 || this.gestureMode === 'multi-touch-blocked') {
      e.preventDefault();
      this.enterMultiTouchBlocked();
      return;
    }
    if (e.type === 'touchmove' && e.touches.length >= 2) {
      e.preventDefault();
    }
    if (fingers >= 2) {
      this.beginTwoFingerSessionIfNeeded();
    }
    if (this.pointers.size === 0 && this.nativeTouchCount === 0) {
      this.resetPinchTracking();
    }
  };

  private lastMoveDropTraceMs = 0;

  private tracePointer(
    e: PointerEvent,
    decision: Parameters<typeof rowFromPointer>[1]['decision'],
    extra?: string,
    capture?: boolean,
  ): void {
    if (e.type === 'pointermove' && decision.startsWith('DROP_')) {
      const now = Date.now();
      if (now - this.lastMoveDropTraceMs < 250) return;
      this.lastMoveDropTraceMs = now;
    }
    if (e.type === 'pointermove' && decision === 'ACCEPT' && !observeAllMoves()) return;
    pushInputTrace(
      rowFromPointer(e, {
        monitorId: this.layout.monitorId,
        windowId: this.ownerWindowId,
        decision,
        nativeTouchCount: this.nativeTouchCount,
        pointerCount: this.pointers.size,
        extra,
        capture,
        activeTouchPointerCount: this.touchPointerCount(),
        gestureMode: this.gestureMode,
        interactionSessionId: this.interactionSessionId,
        pointerSessionId: this.pointers.get(e.pointerId)?.sessionId ?? this.interactionSessionId,
        interactionLocked: !this.interactionEnabled,
      }),
    );
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.lastPointerType = e.pointerType || 'mouse';
    if (e.pointerType === 'touch') this.lastTouchMonitorId = this.layout.monitorId;
    if (!this.pointerEventBelongsHere(e)) {
      this.tracePointer(e, 'DROP_NOT_BELONG_TO_WINDOW');
      return;
    }
    if (!this.interactionEnabled) {
      this.tracePointer(e, 'DROP_INTERACTION_LOCK', `overlayLock cameraPan=false bubbleMayFollow=true`);
      this.updateBubbleFromPointer(e, { show: true, contact: true });
      return;
    }
    e.preventDefault();
    this.callbacks.onValidActivity?.();
    const existing = this.pointers.get(e.pointerId);
    if (isDuplicateLocalPointerDown(existing ? this.toPointerRecord(existing) : undefined, this.interactionSessionId)) {
      this.tracePointer(e, 'DROP_DUPLICATE_POINTERDOWN', `session=${this.interactionSessionId}`);
      try {
        this.renderer.domElement.setPointerCapture?.(e.pointerId);
      } catch {
        /* contact may already be captured */
      }
      this.recordCameraPanDebug(
        e,
        'duplicate-pointerdown-kept',
        existing!.lastX,
        existing!.lastY,
        0,
        0,
        this.targetCameraX,
        this.targetCameraY,
        this.targetCameraX,
        this.targetCameraY,
      );
      this.updateBubbleFromPointer(e, { show: true, contact: true });
      return;
    }
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* synthetic / CDP pointers have no active capture */
    }
    if (this.pointers.size === 0 && this.nativeTouchCount <= 1) {
      this.interactionSessionId += 1;
    }
    this.pointers.set(e.pointerId, {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      startTime: performance.now(),
      dragging: false,
      sessionId: this.interactionSessionId,
      ownerMonitorId: this.layout.monitorId,
      ownerWindowId: this.ownerWindowId,
      ownerDisplayId: this.ownerDisplayId,
      pointerType: e.pointerType || 'mouse',
    });
    if (this.gestureMode === 'multi-touch-blocked' || this.effectiveFingerCount() >= 3) {
      this.tracePointer(e, 'DROP_MULTI_TOUCH_BLOCKED', `fingers=${this.effectiveFingerCount()}`);
      this.enterMultiTouchBlocked();
      return;
    }
    if (this.effectiveFingerCount() >= 2) {
      this.tracePointer(
        e,
        'ACCEPT',
        `twoFingerSession nTouch=${this.nativeTouchCount} nPtr=${this.pointers.size} panXy=false`,
      );
      this.beginTwoFingerSessionIfNeeded();
      this.updateBubbleFromPointer(e, { show: true, contact: true });
      return;
    }
    this.tracePointer(e, 'ACCEPT', `oneFinger session=${this.interactionSessionId}`);
    this.updateBubbleFromPointer(e, { show: true, contact: true });
    if (this.gestureMode === 'idle') this.gestureMode = 'one-finger';
  };

  private applyTwoFingerDollyFromMove(): void {
    const dist = this.pinchDistanceBetween();
    const pinchDelta = this.pinchDistance > 0 ? dist - this.pinchDistance : 0;
    const centroidY = this.pinchCentroidYBetween();
    const deltaY = centroidY - this.pinchCentroidY;
    this.pinchDelta = pinchDelta;
    this.twoFingerDollyDeltaY = deltaY;
    this.twoFingerDollyTotalY = centroidY - this.pinchOriginCentroidY;
    const sessionVert = Math.abs(this.twoFingerDollyTotalY);
    const sessionPinch = Math.abs(dist - this.pinchOriginDistance);

    if (this.gestureMode === 'two-finger-pending') {
      if (sessionVert > TWO_FINGER_VERTICAL_DEAD_ZONE_PX) {
        this.gestureMode = 'two-finger-swipe-dolly';
        this.twoFingerVerticalArmed = true;
        this.applyDollyImpulse(this.twoFingerDollyTotalY, 'two-finger-vertical');
      } else if (sessionPinch > TWO_FINGER_PINCH_DEAD_ZONE_PX) {
        this.gestureMode = 'two-finger-pinch-dolly';
        this.applyDollyImpulse(dist - this.pinchOriginDistance, 'pinch');
      }
    } else if (this.gestureMode === 'two-finger-swipe-dolly') {
      if (Math.abs(deltaY) >= 0.5) {
        this.applyDollyImpulse(deltaY, 'two-finger-vertical');
      }
    } else if (this.gestureMode === 'two-finger-pinch-dolly' && Math.abs(pinchDelta) > 1.5) {
      this.applyDollyImpulse(pinchDelta, 'pinch');
    }

    this.pinchDistance = dist;
    this.pinchCentroidY = centroidY;
    this.pinchActive = this.gestureMode === 'two-finger-pinch-dolly';
    this.twoFingerDollyActive = this.gestureMode === 'two-finger-swipe-dolly';
  }

  private onPointerMove = (e: PointerEvent): void => {
    this.lastPointerType = e.pointerType || this.lastPointerType;
    if (e.pointerType === 'touch') this.lastTouchMonitorId = this.layout.monitorId;
    if (!this.pointerEventBelongsHere(e)) {
      this.tracePointer(e, 'DROP_NOT_BELONG_TO_WINDOW');
      return;
    }
    if (this.gestureMode !== 'multi-touch-blocked' && this.effectiveFingerCount() < 3 && this.isBubbleAllowed()) {
      this.updateBubbleFromPointer(e, {
        show: this.bubbleContactActive || this.bubbleVisible,
      });
    }
    if (!this.interactionEnabled) return;
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    if (p.sessionId !== this.interactionSessionId) {
      this.tracePointer(e, 'DROP_SESSION_MISMATCH', `ptrSession=${p.sessionId} live=${this.interactionSessionId}`);
      return;
    }
    e.preventDefault();
    const totalMove = Math.hypot(e.clientX - p.startX, e.clientY - p.startY);
    if (!p.dragging && totalMove >= listConfig.tapMaxMovePx) {
      p.dragging = true;
      this.callbacks.onValidActivity?.();
    }

    if (this.gestureMode === 'multi-touch-blocked' || this.effectiveFingerCount() >= 3) {
      p.lastX = e.clientX;
      p.lastY = e.clientY;
      this.enterMultiTouchBlocked();
      return;
    }

    if (this.sessionBlocksOneFinger()) {
      if (this.nativeTouchCount >= 2 && this.pointers.size <= 1) {
        this.tracePointer(
          e,
          'DROP_NATIVE_TOUCH_COUNT',
          `panBlocked nTouch=${this.nativeTouchCount} nPtr=${this.pointers.size}`,
        );
      }
      p.lastX = e.clientX;
      p.lastY = e.clientY;
      if (this.pointers.size >= 2) this.applyTwoFingerDollyFromMove();
      return;
    }

    // 1本指のみ camera X/Y pan。2本指は PointerEvent が1本でも TouchEvent で止める。
    // Pan is gated on this window's interactionSessionId — never on global activity IPC.
    if (
      p.dragging &&
      this.pointers.size === 1 &&
      this.nativeTouchCount <= 1 &&
      this.effectiveFingerCount() === 1 &&
      this.gestureMode === 'one-finger' &&
      !this.sessionBlocksOneFinger()
    ) {
      const decision = decideOneFingerPanMove({
        pointer: this.toPointerRecord(p),
        clientX: e.clientX,
        clientY: e.clientY,
        interactionSessionId: this.interactionSessionId,
        ownerMonitorId: this.layout.monitorId,
        ownerWindowId: this.ownerWindowId,
      });
      // stale-start-replay-ignored: M3 focus must not pan M1 via clientX=startX.
      const beforeX = this.targetCameraX;
      const beforeY = this.targetCameraY;
      if (decision.applyPan) {
        const nextX = this.targetCameraX - decision.dx * CAMERA_CONFIG.dragSensitivity;
        const nextY = this.targetCameraY + decision.dy * CAMERA_CONFIG.dragSensitivity;
        if (this.world.mode === 'independent') {
          this.targetCameraX = nextX;
          this.targetCameraY = nextY;
          this.wrapPanLoop();
        } else {
          this.targetCameraX = clamp(nextX, this.panMinX, this.panMaxX);
          this.targetCameraY = clamp(nextY, this.panMinY, this.panMaxY);
        }
      }
      if (decision.reason === 'stale-start-replay-ignored') {
        this.tracePointer(e, 'DROP_STALE_START', `session=${this.interactionSessionId}`);
      } else if (decision.reason === 'session-mismatch-ignored') {
        this.tracePointer(e, 'DROP_SESSION_MISMATCH');
      } else if (decision.reason === 'foreign-window-ignored') {
        this.tracePointer(e, 'DROP_NOT_BELONG_TO_WINDOW', 'foreign-window-ignored');
      }
      this.recordCameraPanDebug(
        e,
        decision.reason,
        p.lastX,
        p.lastY,
        decision.dx,
        decision.dy,
        beforeX,
        beforeY,
        this.targetCameraX,
        this.targetCameraY,
      );
      if (decision.updateLast) {
        p.lastX = e.clientX;
        p.lastY = e.clientY;
      }
      return;
    }
    p.lastX = e.clientX;
    p.lastY = e.clientY;
  };

  private finishPointer(e: PointerEvent, allowTap: boolean): void {
    const p = this.pointers.get(e.pointerId);
    const modeAtUp = this.gestureMode;
    const suppressTap =
      !allowTap ||
      this.sessionBlocksOneFinger() ||
      this.tapSuppressedByPinch ||
      this.tapSuppressedByTwoFinger ||
      this.tapSuppressedByMultiTouch;
    this.pointers.delete(e.pointerId);
    this.bubbleContactActive = this.pointers.size > 0 || this.nativeTouchCount > 0;
    if (this.pointers.size === 0 && this.nativeTouchCount === 0 && this.bubbleVisible) this.scheduleHideBubble();
    if (this.pointers.size < 2) {
      this.pinchActive = false;
      this.twoFingerDollyActive = false;
      this.pinchDelta = 0;
      this.twoFingerDollyDeltaY = 0;
    } else {
      this.pinchDistance = this.pinchDistanceBetween();
    }
    if (this.pointers.size === 0 && this.nativeTouchCount === 0) {
      this.resetPinchTracking();
    }
    if (!p) return;
    const duration = performance.now() - p.startTime;
    const move = Math.hypot(e.clientX - p.startX, e.clientY - p.startY);
    const wasTap =
      this.interactionEnabled &&
      !suppressTap &&
      modeAtUp === 'one-finger' &&
      !p.dragging &&
      move <= listConfig.tapMaxMovePx &&
      duration <= listConfig.tapMaxDurationMs;
    if (wasTap) this.handleTap(e.clientX, e.clientY);
  }

  private onPointerUp = (e: PointerEvent): void => {
    this.tracePointer(e, 'ACCEPT', `up pointersLeft=${Math.max(0, this.pointers.size - (this.pointers.has(e.pointerId) ? 1 : 0))}`);
    this.finishPointer(e, true);
  };

  private onPointerCancel = (e: PointerEvent): void => {
    this.tracePointer(e, 'INFO', 'pointercancel');
    this.finishPointer(e, false);
  };

  private onGotPointerCapture = (e: PointerEvent): void => {
    this.tracePointer(e, 'INFO', 'gotpointercapture', true);
  };

  private onLostPointerCapture = (e: PointerEvent): void => {
    this.tracePointer(e, 'INFO', 'lostpointercapture', true);
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    if (p.pointerType === 'touch' && p.sessionId === this.interactionSessionId) {
      try {
        this.renderer.domElement.setPointerCapture(e.pointerId);
      } catch {
        /* contact ended */
      }
      return;
    }
    this.finishPointer(e, false);
  };

  private onPointerLeave = (e: PointerEvent): void => {
    if (this.pointers.has(e.pointerId) && e.pointerType !== 'touch') {
      this.finishPointer(e, false);
    }
    if (this.pointers.size === 0) {
      this.bubbleContactActive = false;
      this.scheduleHideBubble();
    }
  };

  private onWheel = (e: WheelEvent): void => {
    if (!this.interactionEnabled) return;
    e.preventDefault();
    this.callbacks.onValidActivity?.();
    let delta = e.deltaY;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) delta = e.deltaX;
    if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 16;
    if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= 800;

    const shift = e.shiftKey || this.shiftHeld;
    const trackpadPinch = e.ctrlKey && !shift;
    if (runtimeConfig.dollyCruiseEnabled && (shift || trackpadPinch)) {
      if (shift) this.shiftHeld = true;
      if (delta !== 0) {
        this.applyDollyImpulse(delta, shift ? 'shift-wheel' : 'pinch');
      }
      return;
    }

    this.wheelMode = 'normal';
    this.lastDollyInput = 'wheel';
    this.cruiseVelocityZ *= Math.exp(-DOLLY_CRUISE.scrubCancelBrake * 0.05);
    this.targetCameraZ -= delta * 0.55 * CAMERA_CONFIG.wheelSensitivity * runtimeConfig.cameraDollySpeed;
    this.wrapDepthLoop();
  };

  private handleTap(clientX: number, clientY: number): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNdc.x = ((clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hits = this.raycaster.intersectObjects(this.imageMeshes, false).filter((h) => {
      const mesh = h.object as THREE.Mesh;
      const alpha = mesh.userData.currentAlpha ?? 1;
      return mesh.userData?.isImageCard && mesh.visible && alpha >= listConfig.hitTestMinAlpha;
    });
    this.lastRaycastCandidates = hits.length;
    const chosen = hits[0];
    if (!chosen) {
      this.lastChosenId = null;
      return;
    }
    const mesh = chosen.object as THREE.Mesh;
    const data = mesh.userData;
    const instanceId = String(data.instanceId);
    this.lastChosenId = instanceId;
    this.selectedInstanceId = instanceId;
    this.selectedSourceImageId = data.sourceImageId ? String(data.sourceImageId) : null;
    this.selectedDisplayIndex = typeof data.displayIndex === 'number' ? data.displayIndex : null;
    this.selectedImageUrl = data.imageUrl ? String(data.imageUrl) : null;
    this.selectedRelativePath = data.relativePath ? String(data.relativePath) : null;
    this.selectedTitle = data.title ? String(data.title) : null;
    this.selectedCategoryId = data.categoryId ? String(data.categoryId) : null;
    console.info('[production] list tap', {
      instanceId: this.selectedInstanceId,
      sourceImageId: this.selectedSourceImageId,
      displayIndex: this.selectedDisplayIndex,
      imageUrl: this.selectedImageUrl,
      relativePath: this.selectedRelativePath,
      title: this.selectedTitle,
      categoryId: this.selectedCategoryId,
    });
    this.callbacks.onCardTap({
      instanceId,
      sourceImageId: this.selectedSourceImageId ?? instanceId,
      displayIndex: this.selectedDisplayIndex ?? 0,
      imageUrl: this.selectedImageUrl ?? '',
      relativePath: this.selectedRelativePath ?? undefined,
      title: this.selectedTitle ?? undefined,
      categoryId: this.selectedCategoryId ?? undefined,
    });
  }

  setInteractionEnabled(enabled: boolean): void {
    this.interactionEnabled = enabled;
    if (!enabled) {
      this.pointers.clear();
      this.nativeTouchCount = 0;
      this.cruiseVelocityZ = 0;
      this.lastDollyImpulse = 0;
      this.resetPinchTracking();
      if (this.bubbleVisible) this.recordBubbleAction('hide-disallowed');
      this.bubbleVisible = false;
      this.revealActive = false;
      this.bubbleHasTarget = false;
      this.bubbleContactActive = false;
      if (this.hideBubbleTimer) {
        clearTimeout(this.hideBubbleTimer);
        this.hideBubbleTimer = null;
      }
    }
    this.emitStats(true);
  }

  setOverlayOpen(open: boolean): void {
    this.overlayOpen = open;
    if (open) this.setInteractionEnabled(false);
    else this.emitStats(true);
  }

  setImageZoomLoadStatus(status: ImageZoomLoadStatus): void {
    this.imageZoomLoadStatus = status;
  }

  private onContextLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
    console.error('[production] WebGL context lost');
    void window.trunkApi?.logEvent?.({
      level: 'error',
      message: 'WebGL context lost',
      context: { shell: 'production', phase: 3 },
    });
  };

  private onContextRestored = (): void => {
    this.contextLost = false;
    console.warn('[production] WebGL context restored');
  };

  private applyRuntimeConfig(): void {
    if (this.destroyed || !this.renderer) return;
    this.applyRuntimeVisual();
    this.handleResize();
  }

  private applyRuntimeVisual(): void {
    if (!this.scene) return;
    const preset = getVisualPreset();
    const fog = this.scene.fog;
    if (fog instanceof THREE.FogExp2) fog.density = preset.fogDensity;
    const tint = new THREE.Color(preset.tintHex);
    for (const card of this.cards) {
      const mat = card.mesh.material as THREE.MeshBasicMaterial;
      mat.color.copy(tint);
    }
  }

  private publishDebugSample(): void {
    const now = performance.now();
    const sample = {
      fps: this.currentFps,
      hidden: typeof document !== 'undefined' ? document.hidden : false,
      hasFocus: typeof document !== 'undefined' ? document.hasFocus() : false,
      pixelRatio: this.renderer?.getPixelRatio?.() ?? 0,
      pixelRatioCap: runtimeConfig.rendererPixelRatioMax,
      dragging: [...this.pointers.values()].some((p) => p.dragging),
      pinchActive: this.pinchActive,
      twoFingerDollyActive: this.twoFingerDollyActive,
      twoFingerPanActive: false,
      nativeTouchCount: this.nativeTouchCount,
      lastPointerType: this.lastPointerType,
      lastTouchMonitorId: this.lastTouchMonitorId,
      interactionSessionId: this.interactionSessionId,
      ownerWindowId: this.ownerWindowId,
      ownerDisplayId: this.ownerDisplayId,
      lastCameraUpdateReason: this.lastCameraUpdateReason,
      cameraPanDebug: this.cameraPanDebug.map(formatCameraPanDebugSample),
      bubbleActionDebug: this.bubbleActionDebug.map(formatBubbleActionDebugSample),
      inputTraceDebug: getInputTraceRows(),
      twoFingerDollyDeltaY: this.twoFingerDollyDeltaY,
      twoFingerDollyTotalY: this.twoFingerDollyTotalY,
      wheelMode: this.wheelMode,
      dollyVelocity: this.cruiseVelocityZ,
      lastDollyInput: this.lastDollyInput,
      cameraZ: this.cameraZ,
      targetCameraZ: this.targetCameraZ,
      wrapCount: this.wrapCount,
      shiftHeld: this.shiftHeld,
      meshCount: this.cards.length,
      overlayOpen: this.overlayOpen,
      interactionEnabled: this.interactionEnabled,
      bubbleAllowed: this.isBubbleAllowed(),
      revealActive: this.revealActive,
      selectedInstanceId: this.selectedInstanceId,
      selectedSourceImageId: this.selectedSourceImageId,
      contextLost: this.contextLost,
      nearestCardScreen: this.nearestCardScreenPoint(),
    };
    (window as Window & { __productionDebug?: typeof sample }).__productionDebug = sample;
    if (now - this.lastFpsLogMs < FPS_LOG_MS) return;
    this.lastFpsLogMs = now;
    console.info('[production] fps', sample);
  }

  private nearestCardScreenPoint(): { x: number; y: number; instanceId: string } | null {
    if (!this.renderer || !this.camera || this.cards.length === 0) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    let best: { x: number; y: number; instanceId: string; score: number } | null = null;
    for (const card of this.cards) {
      const ndc = this.projectScratch.copy(card.mesh.position).project(this.camera);
      if (ndc.z < -1 || ndc.z > 1) continue;
      if (Math.abs(ndc.x) > 0.98 || Math.abs(ndc.y) > 0.98) continue;
      const x = rect.left + (ndc.x * 0.5 + 0.5) * rect.width;
      const y = rect.top + (-ndc.y * 0.5 + 0.5) * rect.height;
      const score = ndc.x * ndc.x + ndc.y * ndc.y;
      if (!best || score < best.score) {
        best = { x, y, instanceId: card.meta.instanceId, score };
      }
    }
    return best ? { x: best.x, y: best.y, instanceId: best.instanceId } : null;
  }

  private cardZExtents(): { min: number; max: number } {
    if (this.cards.length === 0) return { min: 0, max: 0 };
    let min = Infinity;
    let max = -Infinity;
    for (const card of this.cards) {
      min = Math.min(min, card.sceneZ);
      max = Math.max(max, card.sceneZ);
    }
    return { min, max };
  }

  private emitStats(force = false): void {
    const now = performance.now();
    if (!force && now - this.lastStatsEmitMs < (Math.abs(this.cruiseVelocityZ) > 2 || this.twoFingerInputHeld() ? 80 : 250)) return;
    this.lastStatsEmitMs = now;
    if (!this.renderer) return;
    const canvas = this.renderer.domElement;
    const bubble = this.getBubbleState();
    this.renderer.getDrawingBufferSize(this.drawingSize);
    const zExt = this.cardZExtents();
    this.callbacks.onStats({
      canvasMounted: true,
      canvasCount: 1,
      canvasCssWidth: canvas.clientWidth,
      canvasCssHeight: canvas.clientHeight,
      drawingBufferWidth: this.drawingSize.x,
      drawingBufferHeight: this.drawingSize.y,
      rendererPixelRatio: this.renderer.getPixelRatio(),
      fps: this.currentFps,
      meshCount: this.cards.length,
      textureCount: this.sharedTextures.size || this.cards.length,
      realImageCount: this.realImageCount,
      displayedImageCount: this.cards.length,
      sourceImageCount: this.sourceImageCount,
      duplicatedCount: this.duplicatedCount,
      textureLoadedCount: this.textureLoadedCount,
      textureFailedCount: this.textureFailedCount,
      contentLoadStatus: this.contentLoadStatus,
      firstImageUrlScheme: this.firstImageUrlScheme,
      fileProtocolTextureLoadResult: this.fileProtocolTextureLoadResult,
      cardGenerationMode: this.cardGenerationMode,
      contentError: this.contentError,
      exploreSource: this.exploreSource,
      contentRoot: this.contentRoot,
      firstImageUrl: this.firstImageUrl,
      wrapCount: this.wrapCount,
      panHardClamp: this.world.mode !== 'independent',
      listWorldMode: this.world.mode,
      worldSeed: this.world.seed,
      worldWidth: this.world.width,
      worldHeight: this.world.height,
      worldScaleMultiplierX: this.world.multiplierX,
      worldScaleMultiplierY: this.world.multiplierY,
      worldReferenceDistance: this.world.referenceDistance,
      viewportWorldWidth: this.world.viewportWidth,
      viewportWorldHeight: this.world.viewportHeight,
      cardSpawnSpanX: this.world.spawnSpanX,
      cardSpawnSpanY: this.world.spawnSpanY,
      targetCardCount: listConfig.targetCardCount,
      panWrapCountX: this.panWrapCountX,
      panWrapCountY: this.panWrapCountY,
      windowInnerWidth: window.innerWidth,
      windowInnerHeight: window.innerHeight,
      cameraAspect: this.camera?.aspect ?? 0,
      cameraXMin: this.panMinX,
      cameraXMax: this.panMaxX,
      cameraYMin: this.panMinY,
      cameraYMax: this.panMaxY,
      cameraX: this.cameraX,
      cameraY: this.cameraY,
      cameraZ: this.cameraZ,
      targetCameraX: this.targetCameraX,
      targetCameraY: this.targetCameraY,
      targetCameraZ: this.targetCameraZ,
      cameraZMin: CAMERA_CONFIG.minZ,
      cameraZMax: CAMERA_CONFIG.maxZ,
      targetCameraZAtMin: this.targetCameraZ <= CAMERA_CONFIG.minZ + CAMERA_Z_EPS,
      targetCameraZAtMax: this.targetCameraZ >= CAMERA_CONFIG.maxZ - CAMERA_Z_EPS,
      cardZMin: zExt.min,
      cardZMax: zExt.max,
      pointerType: this.bubblePointerType,
      isDragging: [...this.pointers.values()].some((p) => p.dragging),
      isPinching: this.pinchActive,
      wheelMode: this.wheelMode,
      shiftWheelActive: this.shiftHeld,
      dollyCruiseEnabled: runtimeConfig.dollyCruiseEnabled,
      dollyVelocity: this.cruiseVelocityZ,
      dollyImpulse: this.lastDollyImpulse,
      dollySmoothing: this.currentPoseSmoothing(),
      dollyFriction: this.currentFriction(),
      dollyImpulseScale: runtimeConfig.cameraDollySpeed,
      pinchActive: this.pinchActive,
      activePointerCount: this.pointers.size,
      activePointerIds: [...this.pointers.keys()],
      pinchDistance: this.pinchDistance,
      pinchDelta: this.pinchDelta,
      pinchDollyScale: runtimeConfig.pinchDollyScale,
      twoFingerDollyActive: this.twoFingerDollyActive,
      twoFingerDollyDeltaY: this.twoFingerDollyDeltaY,
      twoFingerDollyTotalY: this.twoFingerDollyTotalY,
      twoFingerDollyDeadZonePx: TWO_FINGER_VERTICAL_DEAD_ZONE_PX,
      twoFingerDollyMaxDeltaPx: listConfig.twoFingerDollyMaxDeltaPx,
      twoFingerDollyScale: listConfig.twoFingerDollyScale,
      gestureMode: this.gestureMode,
      oneFingerPanActive:
        this.gestureMode === 'one-finger' &&
        this.effectiveFingerCount() === 1 &&
        [...this.pointers.values()].some((row) => row.dragging),
      twoFingerPanActive: false,
      multiTouchBlocked: this.gestureMode === 'multi-touch-blocked',
      nativeTouchCount: this.nativeTouchCount,
      lastPointerType: this.lastPointerType,
      lastTouchMonitorId: this.lastTouchMonitorId,
      interactionSessionId: this.interactionSessionId,
      ownerWindowId: this.ownerWindowId,
      ownerDisplayId: this.ownerDisplayId,
      lastCameraUpdateReason: this.lastCameraUpdateReason,
      cameraPanDebug: this.cameraPanDebug.map(formatCameraPanDebugSample),
      bubbleActionDebug: this.bubbleActionDebug.map(formatBubbleActionDebugSample),
      inputTraceDebug: getInputTraceRows(),
      tapSuppressed:
        this.tapSuppressedByPinch || this.tapSuppressedByTwoFinger || this.tapSuppressedByMultiTouch,
      tapSuppressedByTwoFinger: this.tapSuppressedByTwoFinger,
      tapSuppressedByMultiTouch: this.tapSuppressedByMultiTouch,
      lastDollyInput: this.lastDollyInput,
      tapSuppressedByPinch: this.tapSuppressedByPinch,
      selectedInstanceId: this.selectedInstanceId,
      selectedSourceImageId: this.selectedSourceImageId,
      selectedDisplayIndex: this.selectedDisplayIndex,
      selectedImageUrl: this.selectedImageUrl,
      selectedRelativePath: this.selectedRelativePath,
      selectedTitle: this.selectedTitle,
      selectedCategoryId: this.selectedCategoryId,
      chosenImageId: this.lastChosenId,
      raycastCandidateCount: this.lastRaycastCandidates,
      imageZoomOpen: this.overlayOpen,
      exploreHostMounted: true,
      exploreInteractionEnabled: this.interactionEnabled,
      imageZoomLoadStatus: this.imageZoomLoadStatus,
      cardLongSide: CARD_LONG_SIDE,
      cardScaleMin: CARD_SCALE_RANGE.min,
      cardScaleMax: CARD_SCALE_RANGE.max,
      cameraFov: this.camera?.fov ?? CAMERA_CONFIG.fov,
      initialCameraZ: CAMERA_CONFIG.initialZ,
      sceneSpreadX: Math.round(this.world.spawnSpanX),
      sceneSpreadY: Math.round(this.world.spawnSpanY),
      sceneSpreadZ: SCENE_LAYOUT.zRange[1] - SCENE_LAYOUT.zRange[0],
      bubbleEnabled: bubble.enabled,
      bubbleVisible: bubble.visible,
      bubbleX: bubble.screenX,
      bubbleY: bubble.screenY,
      bubbleMonitorId: bubble.bubbleMonitorId,
      bubbleAllowed: bubble.allowed,
      bubbleSizePx: bubble.sizePx,
      revealRadiusPx: bubble.revealRadiusPx,
      bubbleFollowSmoothing: listConfig.bubbleFollowSmoothing,
      revealActive: bubble.revealActive,
      revealCenterNdcX: bubble.revealCenterNdcX,
      revealCenterNdcY: bubble.revealCenterNdcY,
      bubbleScreenX: bubble.screenX,
      bubbleScreenY: bubble.screenY,
      densityPreset: listConfig.densityPreset,
      nearFadeStartDist: CARD_MOTION.nearFadeStartDist,
      nearFadeEndDist: CARD_MOTION.nearFadeEndDist,
      nearScaleStartDistUsed: CARD_MOTION.nearScaleEnabled,
      nearScaleMinUsed: CARD_MOTION.nearScaleEnabled,
      maxScaleClamp: CARD_MOTION.maxScaleClamp,
      maxApparentScaleDist: CARD_MOTION.maxApparentScaleDist,
      nearFadeAlpha: (() => {
        let best = Infinity;
        let fade = 1;
        for (const card of this.cards) {
          const dist = this.cameraZ - card.sceneZ;
          if (dist >= 0 && dist < best) {
            best = dist;
            fade = Number(card.mesh.userData.nearFadeAlpha ?? card.mesh.userData.currentAlpha ?? 1);
          }
        }
        return fade;
      })(),
      monitorId: this.layout.monitorId,
      viewportOffsetX: this.layout.viewportOffsetX,
      viewportOffsetY: this.layout.viewportOffsetY,
      layoutScale: this.layout.scale,
      orientation: this.layout.orientation,
      layoutWidth: this.layout.width,
      layoutHeight: this.layout.height,
      devicePixelRatio: window.devicePixelRatio || 1,
      contextLost: this.contextLost,
    });
  }
}
