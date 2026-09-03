import * as THREE from 'three';
import { loadContentCards } from '../contentCards';
import { demoConfig } from '../demoConfig';
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
  SelectedDemoCard,
} from '../types';
import { attachBubbleRevealShader, createRevealUniforms, type RevealUniforms } from './bubbleRevealShader';
import { FpsCounter } from './fpsCounter';
import { createPlaceholderCanvas } from './placeholderCards';
import { buildScenePlacements, CAMERA_CONFIG, CARD_MOTION, CARD_SCALE_RANGE, DOLLY_CRUISE, SCENE_LAYOUT } from './sceneLayout';

const CARD_LONG_SIDE = 280;
const TEXTURE_LOAD_CONCURRENCY = 4;
const CAMERA_Z_EPS = 1.5;
const FPS_LOG_MS = 2000;

interface PointerState {
  id: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startTime: number;
  dragging: boolean;
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
}

export interface ExploreControllerCallbacks {
  onStats(stats: ListDebugStats): void;
  onReady(): void;
  onCardTap(card: SelectedDemoCard): void;
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
  private textureOkByScheme = { file: 0, custom: 0, other: 0 };
  private textureFailByScheme = { file: 0, custom: 0, other: 0 };
  private sharedTextures = new Map<string, THREE.Texture>();
  private projectScratch = new THREE.Vector3();
  private overlayOpen = false;
  private imageZoomLoadStatus: ImageZoomLoadStatus = 'idle';
  private contextLost = false;

  constructor(private callbacks: ExploreControllerCallbacks) {}

  getContentLoadStatus(): ContentLoadStatus {
    return this.contentLoadStatus;
  }

  async init(host: HTMLElement): Promise<void> {
    try {
      await this.initInner(host);
    } catch (err) {
      console.error('[0820] explore init failed', err);
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

    this.contentLoadStatus = 'loading';
    const loaded = await loadContentCards();
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
    const placements = buildScenePlacements(metas.length);
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
      console.error('[0820]', this.contentError);
    }

    void window.trunkApi?.logEvent?.({
      level: this.textureLoadedCount > 0 ? 'info' : 'warn',
      message: '0820 content textures',
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
      console.error('[0820] texture load failed', {
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
      console.warn('[0820] TextureLoader failed, retrying with Image()', { url, error: loaderMessage });
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
    const [xMin, xMax] = SCENE_LAYOUT.xRange;
    const [yMin, yMax] = SCENE_LAYOUT.yRange;

    for (const card of this.cards) {
      card.sceneZ += cam.sceneDriftSpeed * card.driftMul * speed * deltaTime;
      const dist = this.cameraZ - card.sceneZ;

      if (dist < cam.nearFadeEndDist) {
        card.sceneZ = this.cameraZ - cam.farAlphaSoftDist + Math.random() * 400;
        card.sceneX = lerp(xMin, xMax, Math.random());
        card.sceneY = lerp(yMin, yMax, Math.random());
      } else if (dist > cam.farFadeEndDist) {
        card.sceneZ = this.cameraZ - lerp(cam.nearFadeStartDist + 40, cam.farAlphaStartDist * 0.55, Math.random());
        card.sceneX = lerp(xMin, xMax, Math.random());
        card.sceneY = lerp(yMin, yMax, Math.random());
      }

      const t = this.clockTime * card.idleSpeed * speed;
      const yAmp = lerp(cam.idleYAmpMin, cam.idleYAmpMax, card.idleIntensity);
      const xAmp = lerp(cam.idleXAmpMin, cam.idleXAmpMax, card.idleIntensity);
      const rotAmp = ((cam.idleRotAmpDeg * Math.PI) / 180) * card.idleIntensity;
      card.mesh.position.set(
        card.sceneX + Math.sin(t * 0.71 + card.idlePhaseX) * xAmp,
        card.sceneY + Math.sin(t + card.idlePhaseY) * yAmp,
        card.sceneZ,
      );
      card.mesh.rotation.set(0, 0, Math.sin(t * 0.61 + card.idlePhaseRot) * rotAmp);

      const nearFade =
        dist >= cam.nearFadeStartDist ? 1 : smoothstep(cam.nearFadeEndDist, cam.nearFadeStartDist, dist);
      let depthAlpha = 1;
      if (dist > cam.farAlphaStartDist) {
        depthAlpha = lerp(1, cam.farAlphaFloor, smoothstep(cam.farAlphaStartDist, cam.farAlphaSoftDist, dist));
      }
      const alpha = depthAlpha * nearFade;
      const mat = card.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = alpha;
      card.mesh.userData.currentAlpha = alpha;
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
    const idleSmoothing = clamp(CAMERA_CONFIG.smoothing * demoConfig.cameraSmoothing, 0.02, 1);
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
   * Shift+wheel / pinch 共通の奥行きクルーズ。
   * deltaPx の符号は source ごとに解釈する（DI と同じく Shift は負 delta = 潜る）。
   */
  private applyDollyImpulse(deltaPx: number, source: Exclude<DollyInputSource, 'wheel' | 'none'>): void {
    if (!runtimeConfig.dollyCruiseEnabled) return;
    const direction: 1 | -1 = source === 'pinch' ? (deltaPx > 0 ? 1 : -1) : deltaPx < 0 ? 1 : -1;
    const mag = Math.min(Math.abs(deltaPx), DOLLY_CRUISE.impulseDeltaCapPx);
    const pinchScale = source === 'pinch' ? runtimeConfig.pinchDollyScale : 1;
    const impulse = (mag / 100) * DOLLY_CRUISE.impulsePer100px * runtimeConfig.cameraDollySpeed * pinchScale;
    this.cruiseVelocityZ += direction > 0 ? -impulse : impulse;
    this.cruiseVelocityZ = clamp(this.cruiseVelocityZ, -DOLLY_CRUISE.maxSpeed, DOLLY_CRUISE.maxSpeed);
    this.lastDollyImpulse = impulse;
    this.lastDollyInput = source;
    this.wheelMode = 'dolly-cruise';
  }

  private updateDollyMotion(deltaTime: number): void {
    const cfg = DOLLY_CRUISE;
    const inputHeld = this.shiftHeld || this.pinchActive;
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
    return this.shiftHeld || this.pinchActive ? DOLLY_CRUISE.coastFriction : DOLLY_CRUISE.releaseBrake;
  }

  private currentPoseSmoothing(): number {
    const cruising = Math.abs(this.cruiseVelocityZ) > DOLLY_CRUISE.activeSpeed;
    if (cruising) return runtimeConfig.dollyPoseSmoothing;
    return clamp(CAMERA_CONFIG.smoothing * demoConfig.cameraSmoothing, 0.02, 1);
  }

  private pinchDistanceBetween(): number {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0]!.lastX - pts[1]!.lastX, pts[0]!.lastY - pts[1]!.lastY);
  }

  private beginPinchIfNeeded(): void {
    if (this.pointers.size < 2) return;
    if (!this.pinchActive) {
      this.pinchDistance = this.pinchDistanceBetween();
      this.pinchDelta = 0;
    }
    this.pinchActive = true;
    this.pinchSession = true;
    this.tapSuppressedByPinch = true;
  }

  private resetPinchTracking(): void {
    this.pinchActive = false;
    this.pinchSession = false;
    this.tapSuppressedByPinch = false;
    this.pinchDistance = 0;
    this.pinchDelta = 0;
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
    return {
      enabled: demoConfig.bubbleEnabled,
      visible: this.bubbleVisible && allowed,
      allowed,
      screenX: this.bubbleScreenX,
      screenY: this.bubbleScreenY,
      sizePx: runtimeConfig.bubbleSizePx,
      revealRadiusPx: runtimeConfig.revealRadiusPx,
      pointerType: this.bubblePointerType,
      revealCenterNdcX: this.revealCenterNdcX,
      revealCenterNdcY: this.revealCenterNdcY,
      revealActive: this.revealActive,
    };
  }

  private isBubbleAllowed(): boolean {
    return demoConfig.bubbleEnabled && this.interactionEnabled && !this.overlayOpen;
  }

  private showBubbleAt(clientX: number, clientY: number, pointerType: string): void {
    if (!this.isBubbleAllowed()) return;
    if (this.hideBubbleTimer) {
      clearTimeout(this.hideBubbleTimer);
      this.hideBubbleTimer = null;
    }
    this.bubbleTargetX = clientX;
    this.bubbleTargetY = clientY;
    this.bubbleHasTarget = true;
    this.bubblePointerType = pointerType;
    this.bubbleVisible = true;
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
    }, demoConfig.bubbleHideDelayMs);
  }

  private updateBubbleFromPointer(e: PointerEvent, opts: { show?: boolean; contact?: boolean } = {}): void {
    if (!this.isBubbleAllowed()) return;
    if (opts.show || this.bubbleVisible) {
      this.showBubbleAt(e.clientX, e.clientY, e.pointerType || 'mouse');
    }
    if (opts.contact) this.bubbleContactActive = true;
  }

  private updateBubbleFollow(): void {
    if (!this.bubbleHasTarget || !this.isBubbleAllowed()) {
      if (!this.isBubbleAllowed()) {
        this.bubbleVisible = false;
        this.revealActive = false;
      }
      return;
    }
    const s = demoConfig.bubbleFollowSmoothing;
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
      console.error('[0820] explore destroy failed', err);
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
    el.addEventListener('pointercancel', this.onPointerUp);
    el.addEventListener('pointerleave', this.onPointerLeave);
  }

  private unbindPointer(): void {
    const el = this.renderer?.domElement;
    if (!el) return;
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('pointercancel', this.onPointerUp);
    el.removeEventListener('pointerleave', this.onPointerLeave);
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
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.updateBubbleFromPointer(e, { show: true, contact: true });
    if (!this.interactionEnabled) return;
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* synthetic / CDP pointers have no active capture */
    }
    this.pointers.set(e.pointerId, {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      startTime: performance.now(),
      dragging: false,
    });
    this.beginPinchIfNeeded();
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.isBubbleAllowed()) {
      this.updateBubbleFromPointer(e, {
        show: this.bubbleContactActive || this.bubbleVisible || true,
      });
    }
    if (!this.interactionEnabled) return;
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.lastX;
    const dy = e.clientY - p.lastY;
    const totalMove = Math.hypot(e.clientX - p.startX, e.clientY - p.startY);
    if (!p.dragging && totalMove >= demoConfig.tapMaxMovePx) p.dragging = true;
    p.lastX = e.clientX;
    p.lastY = e.clientY;

    if (this.pointers.size >= 2) {
      this.beginPinchIfNeeded();
      const dist = this.pinchDistanceBetween();
      const delta = this.pinchDistance > 0 ? dist - this.pinchDistance : 0;
      this.pinchDelta = delta;
      if (Math.abs(delta) > 0.5) {
        this.applyDollyImpulse(delta, 'pinch');
      }
      this.pinchDistance = dist;
      return;
    }

    if (p.dragging && this.pointers.size === 1 && !this.pinchSession) {
      this.targetCameraX = clamp(
        this.targetCameraX - dx * CAMERA_CONFIG.dragSensitivity,
        CAMERA_CONFIG.minX,
        CAMERA_CONFIG.maxX,
      );
      this.targetCameraY = clamp(
        this.targetCameraY + dy * CAMERA_CONFIG.dragSensitivity,
        CAMERA_CONFIG.minY,
        CAMERA_CONFIG.maxY,
      );
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    const suppressTap = this.pinchSession || this.tapSuppressedByPinch;
    this.pointers.delete(e.pointerId);
    this.bubbleContactActive = this.pointers.size > 0;
    if (this.pointers.size === 0 && this.bubbleVisible) this.scheduleHideBubble();
    if (this.pointers.size < 2) {
      this.pinchActive = false;
      this.pinchDelta = 0;
    } else {
      this.pinchDistance = this.pinchDistanceBetween();
    }
    if (this.pointers.size === 0) {
      this.pinchSession = false;
      this.pinchDistance = 0;
    }
    if (!p) return;
    const duration = performance.now() - p.startTime;
    const move = Math.hypot(e.clientX - p.startX, e.clientY - p.startY);
    const wasTap =
      this.interactionEnabled &&
      !suppressTap &&
      !p.dragging &&
      move <= demoConfig.tapMaxMovePx &&
      duration <= demoConfig.tapMaxDurationMs;
    if (this.pointers.size === 0) this.tapSuppressedByPinch = false;
    if (wasTap) this.handleTap(e.clientX, e.clientY);
  };

  private onPointerLeave = (e: PointerEvent): void => {
    if (this.pointers.has(e.pointerId)) this.onPointerUp(e);
    if (this.pointers.size === 0) {
      this.bubbleContactActive = false;
      this.scheduleHideBubble();
    }
  };

  private onWheel = (e: WheelEvent): void => {
    if (!this.interactionEnabled) return;
    e.preventDefault();
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
      return mesh.userData?.isImageCard && mesh.visible && alpha >= demoConfig.hitTestMinAlpha;
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
    console.info('[0820] list tap', {
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
      this.cruiseVelocityZ = 0;
      this.lastDollyImpulse = 0;
      this.resetPinchTracking();
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
    console.error('[0820] WebGL context lost');
    void window.trunkApi?.logEvent?.({
      level: 'error',
      message: 'WebGL context lost',
      context: { demo: '0820', phase: 8 },
    });
  };

  private onContextRestored = (): void => {
    this.contextLost = false;
    console.warn('[0820] WebGL context restored');
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
    (window as Window & { __0820Debug?: typeof sample }).__0820Debug = sample;
    if (now - this.lastFpsLogMs < FPS_LOG_MS) return;
    this.lastFpsLogMs = now;
    console.info('[0820] fps', sample);
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
    if (!force && now - this.lastStatsEmitMs < (Math.abs(this.cruiseVelocityZ) > 2 || this.pinchActive ? 80 : 250)) return;
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
      panHardClamp: true,
      cameraXMin: CAMERA_CONFIG.minX,
      cameraXMax: CAMERA_CONFIG.maxX,
      cameraYMin: CAMERA_CONFIG.minY,
      cameraYMax: CAMERA_CONFIG.maxY,
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
      pinchDistance: this.pinchDistance,
      pinchDelta: this.pinchDelta,
      pinchDollyScale: runtimeConfig.pinchDollyScale,
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
      sceneSpreadX: SCENE_LAYOUT.xRange[1] - SCENE_LAYOUT.xRange[0],
      sceneSpreadY: SCENE_LAYOUT.yRange[1] - SCENE_LAYOUT.yRange[0],
      sceneSpreadZ: SCENE_LAYOUT.zRange[1] - SCENE_LAYOUT.zRange[0],
      bubbleEnabled: bubble.enabled,
      bubbleVisible: bubble.visible,
      bubbleAllowed: bubble.allowed,
      bubbleSizePx: bubble.sizePx,
      revealRadiusPx: bubble.revealRadiusPx,
      bubbleFollowSmoothing: demoConfig.bubbleFollowSmoothing,
      revealActive: bubble.revealActive,
      revealCenterNdcX: bubble.revealCenterNdcX,
      revealCenterNdcY: bubble.revealCenterNdcY,
      bubbleScreenX: bubble.screenX,
      bubbleScreenY: bubble.screenY,
    });
  }
}
