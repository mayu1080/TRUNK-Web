import * as THREE from 'three';
import { loadListImages } from '../assetLoader';
import type { AssetLoadResult, DebugStats, DemoListImage } from '../types';
import { FpsCounter } from './fpsCounter';
import {
  buildScenePlacements,
  CAMERA_CONFIG,
  CARD_MOTION,
  DOLLY_CRUISE,
  HIT_TEST_MIN_ALPHA,
  mapCameraZToTimeline,
  SCENE_LAYOUT,
  TAP_THRESHOLD,
} from './sceneLayout';
import { runRaycastHitTest, type HitTestDebugSnapshot } from './hitTestDiagnostics';
import {
  DEFAULT_PRESET,
  getVisualConfig,
  type DfVisualConfig,
  type VisualPresetId,
} from '../visualConfig';

export interface ThreeImageCard {
  id: string;
  imageUrl: string;
  sceneX: number;
  sceneY: number;
  sceneZ: number;
  width: number;
  height: number;
  mesh: THREE.Mesh;
  texture: THREE.Texture;
  baseTint: THREE.Color;
  stableIndex: number;
  driftMul: number;
  idleIntensity: number;
  idleSpeed: number;
  idlePhaseX: number;
  idlePhaseY: number;
  idlePhaseRot: number;
}

export interface ExploreControllerCallbacks {
  onStats(stats: DebugStats, warnings: string[]): void;
  onImageTap(meta: { id: string; url: string }): void;
  onReady(): void;
  onHitTestSnapshot?(snapshot: HitTestDebugSnapshot): void;
}

interface PointerState {
  id: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startTime: number;
  dragging: boolean;
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

/** 方式A: 正面向き固定（カメラ -Z を向く） */
function faceCameraForward(mesh: THREE.Mesh, rotZ = 0): void {
  mesh.rotation.set(0, 0, rotZ);
}

export class ExploreController {
  private host!: HTMLElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private cards: ThreeImageCard[] = [];
  private imageMeshes: THREE.Object3D[] = [];
  private raycaster = new THREE.Raycaster();
  private pointerNdc = new THREE.Vector2();
  private fpsCounter = new FpsCounter();
  private raf = 0;
  private destroyed = false;
  private interactionEnabled = true;
  private overlayOpen = false;
  private drawerOpen = false;
  private assetResult!: AssetLoadResult;
  private warnings: string[] = [];
  private selectedImageId: string | null = null;
  private lastRaycastCandidates = 0;
  private lastChosenId: string | null = null;
  private lastChosenDistance: number | null = null;
  private lastStatsEmitMs = 0;
  private lastFrameMs = performance.now();
  private clockTime = 0;
  private respawnCount = 0;

  private cameraX = CAMERA_CONFIG.initialX;
  private cameraY = CAMERA_CONFIG.initialY;
  private cameraZ = CAMERA_CONFIG.initialZ;
  private targetCameraX = CAMERA_CONFIG.initialX;
  private targetCameraY = CAMERA_CONFIG.initialY;
  private targetCameraZ = CAMERA_CONFIG.initialZ;
  private timelinePosition = mapCameraZToTimeline(CAMERA_CONFIG.initialZ);
  private targetTimelinePosition = this.timelinePosition;

  /** Shift+wheel クルーズ速度 [unit/s] — 負=潜る / 正=引く */
  private cruiseVelocityZ = 0;
  private shiftHeld = false;
  private targetFov = CAMERA_CONFIG.fov;

  private visualConfig: DfVisualConfig = getVisualConfig(DEFAULT_PRESET);
  private hitTestDebugEnabled = false;
  private lastHitTestSnapshot: HitTestDebugSnapshot | null = null;

  private pointers = new Map<number, PointerState>();
  private resizeObserver: ResizeObserver | null = null;

  constructor(private callbacks: ExploreControllerCallbacks) {}

  async init(host: HTMLElement): Promise<void> {
    this.host = host;
    this.assetResult = await loadListImages();
    this.warnings = [...this.assetResult.warnings];
    if (this.destroyed) return;

    const width = host.clientWidth || window.innerWidth;
    const height = host.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height, false);
    this.renderer.setClearColor(0x0a0a0a, 1);
    this.renderer.domElement.className = 'three-canvas';
    this.renderer.domElement.style.touchAction = 'none';
    host.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a0a0a, this.visualConfig.fogDensity);

    this.camera = new THREE.PerspectiveCamera(
      CAMERA_CONFIG.fov,
      width / height,
      CAMERA_CONFIG.near,
      CAMERA_CONFIG.far,
    );
    this.applyCameraPose(true);

    await this.buildImageCards(this.assetResult.images);
    if (this.destroyed) return;

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

      this.updateCameraSmoothing(deltaTime);
      this.updateCardMotion(deltaTime);
      this.renderer.render(this.scene, this.camera);
      this.emitStats();
    };
    this.raf = requestAnimationFrame(tick);
    this.callbacks.onReady();
  }

  private async buildImageCards(images: DemoListImage[]): Promise<void> {
    const loader = new THREE.TextureLoader();
    const placements = buildScenePlacements(images.length);

    for (let i = 0; i < images.length; i++) {
      if (this.destroyed) return;
      const meta = images[i]!;
      const place = placements[i]!;

      let texture: THREE.Texture;
      try {
        texture = await loader.loadAsync(meta.url);
      } catch {
        this.warnings.push(`texture load failed: ${meta.id}`);
        continue;
      }

      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;

      const img = texture.image as { width?: number; height?: number };
      const iw = img.width || 512;
      const ih = img.height || 512;
      const longSide = 280 * place.scaleMul;
      const aspect = iw / ih;
      const width = aspect >= 1 ? longSide : longSide * aspect;
      const height = aspect >= 1 ? longSide / aspect : longSide;

      const geometry = new THREE.PlaneGeometry(width, height);
      const tint = new THREE.Color(this.visualConfig.tintHex);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: this.visualConfig.listAlpha,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        color: tint.clone(),
        fog: true,
      });
      material.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <map_fragment>',
          /* glsl */ `
          #include <map_fragment>
          float gray = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          diffuseColor.rgb = vec3(gray);
          `,
        );
      };
      material.needsUpdate = true;

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(place.sceneX, place.sceneY, place.sceneZ);
      faceCameraForward(mesh);
      mesh.userData = {
        imageId: meta.id,
        imageUrl: meta.url,
        currentAlpha: this.visualConfig.listAlpha,
        isImageCard: true,
      };
      mesh.renderOrder = Math.round(-place.sceneZ);

      const driftMul = 1 + (Math.random() * 2 - 1) * CARD_MOTION.sceneDriftVariance;
      const idleIntensity = 0.25 + Math.random() * 0.75;
      const idleSpeed = lerp(CARD_MOTION.idleSpeedMin, CARD_MOTION.idleSpeedMax, Math.random());

      this.scene.add(mesh);
      this.imageMeshes.push(mesh);
      this.cards.push({
        id: meta.id,
        imageUrl: meta.url,
        sceneX: place.sceneX,
        sceneY: place.sceneY,
        sceneZ: place.sceneZ,
        width,
        height,
        mesh,
        texture,
        baseTint: tint,
        stableIndex: i,
        driftMul,
        idleIntensity,
        idleSpeed,
        idlePhaseX: Math.random() * Math.PI * 2,
        idlePhaseY: Math.random() * Math.PI * 2,
        idlePhaseRot: Math.random() * Math.PI * 2,
      });
    }
  }

  /**
   * 奥→手前ドリフト + idle 浮遊
   * Three: カメラは +Z 側から -Z 方向を見る → 手前へは sceneZ を増やす
   */
  private updateCardMotion(deltaTime: number): void {
    const cam = CARD_MOTION;
    const [xMin, xMax] = SCENE_LAYOUT.xRange;
    const [yMin, yMax] = SCENE_LAYOUT.yRange;

    for (const card of this.cards) {
      // 奥→手前（カメラに近づく）
      card.sceneZ += cam.sceneDriftSpeed * card.driftMul * deltaTime;

      const dist = this.cameraZ - card.sceneZ;

      // 手前抜け → 奥へ再配置（DE 相当の循環）
      if (dist < cam.nearFadeEndDist) {
        card.sceneZ = this.cameraZ - cam.farAlphaSoftDist + Math.random() * 400;
        card.sceneX = lerp(xMin, xMax, Math.random());
        card.sceneY = lerp(yMin, yMax, Math.random());
        this.respawnCount += 1;
      } else if (dist > cam.farFadeEndDist) {
        // 巻戻しで奥に飛びすぎ → 手前帯へ再配置
        card.sceneZ =
          this.cameraZ -
          lerp(cam.nearFadeStartDist + 40, cam.farAlphaStartDist * 0.55, Math.random());
        card.sceneX = lerp(xMin, xMax, Math.random());
        card.sceneY = lerp(yMin, yMax, Math.random());
        this.respawnCount += 1;
      }

      // idle 浮遊
      const t = this.clockTime * card.idleSpeed;
      const yAmp = lerp(cam.idleYAmpMin, cam.idleYAmpMax, card.idleIntensity);
      const xAmp = lerp(cam.idleXAmpMin, cam.idleXAmpMax, card.idleIntensity);
      const rotAmp = (cam.idleRotAmpDeg * Math.PI) / 180 * card.idleIntensity;
      const idleX = Math.sin(t * 0.71 + card.idlePhaseX) * xAmp;
      const idleY = Math.sin(t + card.idlePhaseY) * yAmp;
      const idleRot = Math.sin(t * 0.61 + card.idlePhaseRot) * rotAmp;

      card.mesh.position.set(card.sceneX + idleX, card.sceneY + idleY, card.sceneZ);
      faceCameraForward(card.mesh, idleRot);
      card.mesh.renderOrder = Math.round(-card.sceneZ);

      // CULTISH 寄り — 手前〜中は不透明、奥だけ少し alpha
      const nearFade =
        dist >= cam.nearFadeStartDist
          ? 1
          : smoothstep(cam.nearFadeEndDist, cam.nearFadeStartDist, dist);
      const farFade =
        dist <= cam.farFadeStartDist
          ? 1
          : 1 - smoothstep(cam.farFadeStartDist, cam.farFadeEndDist, dist);

      let depthAlpha = cam.nearAlphaBoost;
      if (dist > cam.farAlphaStartDist) {
        const farT = smoothstep(cam.farAlphaStartDist, cam.farAlphaSoftDist, dist);
        depthAlpha = lerp(cam.nearAlphaBoost, cam.farAlphaFloor, farT);
      }
      const alpha = this.visualConfig.listAlpha * depthAlpha * nearFade * farFade;

      const tintFarT =
        dist <= cam.farAlphaStartDist
          ? 0
          : smoothstep(cam.farAlphaStartDist, cam.farAlphaSoftDist, dist);
      const tintMul = lerp(1, cam.farTintDarken, tintFarT);
      const mat = card.mesh.material as THREE.MeshBasicMaterial;
      mat.color.copy(card.baseTint).multiplyScalar(tintMul);
      mat.opacity = alpha;
      card.mesh.userData.currentAlpha = alpha;
      card.mesh.visible = alpha > 0.02;

      const scaleMul = lerp(cam.nearScaleBoost, cam.farScaleMul, tintFarT) * nearFade;
      card.mesh.scale.setScalar(scaleMul);
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
    this.integrateDollyCruise(deltaTime);

    const cruising = Math.abs(this.cruiseVelocityZ) > 8;
    const s = cruising ? DOLLY_CRUISE.poseSmoothingCruise : CAMERA_CONFIG.smoothing;
    this.cameraX = lerp(this.cameraX, this.targetCameraX, s);
    this.cameraY = lerp(this.cameraY, this.targetCameraY, s);
    this.cameraZ = lerp(this.cameraZ, this.targetCameraZ, s);
    this.timelinePosition = lerp(this.timelinePosition, this.targetTimelinePosition, s);

    const speedT = clamp(Math.abs(this.cruiseVelocityZ) / DOLLY_CRUISE.maxSpeed, 0, 1);
    this.targetFov = CAMERA_CONFIG.fov + DOLLY_CRUISE.fovWidenAtFullSpeed * speedT;
    if (Math.abs(this.camera.fov - this.targetFov) > 0.01) {
      this.camera.fov = lerp(this.camera.fov, this.targetFov, DOLLY_CRUISE.fovSmoothing);
      this.camera.updateProjectionMatrix();
    }

    this.applyCameraPose(false);
  }

  /**
   * Cruise 積分: 慣性・摩擦。
   * Z 限界では止めず、世界ごと wrap して無限循環（DE のカード循環に相当）。
   */
  private integrateDollyCruise(deltaTime: number): void {
    const cfg = DOLLY_CRUISE;
    const friction = this.shiftHeld ? cfg.coastFriction : cfg.releaseBrake;
    this.cruiseVelocityZ *= Math.exp(-friction * deltaTime);

    if (Math.abs(this.cruiseVelocityZ) < 2) {
      this.cruiseVelocityZ = 0;
      return;
    }

    this.cruiseVelocityZ = clamp(this.cruiseVelocityZ, -cfg.maxSpeed, cfg.maxSpeed);
    this.targetCameraZ += this.cruiseVelocityZ * deltaTime;
    this.wrapDepthLoop();
    this.targetTimelinePosition = mapCameraZToTimeline(this.targetCameraZ);
  }

  /**
   * cameraZ が [minZ, maxZ] を出たら、カメラ＋全カードの sceneZ を同量ずらす。
   * 相対配置が保たれるので見た目は連続したまま無限に進める。
   */
  private wrapDepthLoop(): void {
    if (!DOLLY_CRUISE.infiniteLoop) {
      this.targetCameraZ = clamp(this.targetCameraZ, CAMERA_CONFIG.minZ, CAMERA_CONFIG.maxZ);
      return;
    }

    const { minZ, maxZ } = CAMERA_CONFIG;
    const span = maxZ - minZ;
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

    this.cameraZ += delta;
    for (const card of this.cards) {
      card.sceneZ += delta;
    }
  }

  setInteractionEnabled(enabled: boolean): void {
    this.interactionEnabled = enabled;
  }

  setOverlayOpen(open: boolean): void {
    this.overlayOpen = open;
  }

  setDrawerOpen(open: boolean): void {
    this.drawerOpen = open;
  }

  setPreset(presetId: VisualPresetId): void {
    this.visualConfig = getVisualConfig(presetId);
    this.applyVisualConfig();
  }

  setHitTestDebugEnabled(enabled: boolean): void {
    this.hitTestDebugEnabled = enabled;
  }

  getHitTestDebugSnapshot(): HitTestDebugSnapshot | null {
    return this.lastHitTestSnapshot;
  }

  private applyVisualConfig(): void {
    const cfg = this.visualConfig;
    if (this.scene?.fog && this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = cfg.fogDensity;
    }
    const tint = new THREE.Color(cfg.tintHex);
    for (const card of this.cards) {
      card.baseTint.copy(tint);
      const mat = card.mesh.material as THREE.MeshBasicMaterial;
      mat.color.copy(tint);
    }
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.renderer?.domElement ?? null;
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    this.unbindPointer();
    this.unbindWheel();
    this.unbindShiftKeys();

    for (const card of this.cards) {
      card.texture.dispose();
      card.mesh.geometry.dispose();
      (card.mesh.material as THREE.Material).dispose();
      this.scene.remove(card.mesh);
    }
    this.cards = [];
    this.imageMeshes = [];
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }

  private handleResize(): void {
    if (!this.host || !this.renderer) return;
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  private bindPointer(): void {
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointercancel', this.onPointerUp);
    el.addEventListener('pointerleave', this.onPointerUp);
  }

  private unbindPointer(): void {
    const el = this.renderer?.domElement;
    if (!el) return;
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('pointercancel', this.onPointerUp);
    el.removeEventListener('pointerleave', this.onPointerUp);
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

  /**
   * Shift+wheel 方向 — 多くのブラウザで Shift+縦が deltaX に化けるため両軸を見る。
   * +1 = 上（潜る）/ -1 = 下（引く）
   */
  private resolveCruiseWheelDirection(e: WheelEvent): 1 | -1 | null {
    let { deltaX, deltaY } = e;
    if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      deltaX *= 16;
      deltaY *= 16;
    } else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      deltaX *= 800;
      deltaY *= 800;
    }
    const useHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
    const delta = useHorizontal ? deltaX : deltaY;
    if (delta === 0) return null;
    return delta < 0 ? 1 : -1;
  }

  private normalizeWheelDeltaY(e: WheelEvent): number {
    let delta = e.deltaY;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) delta = e.deltaX;
    if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 16;
    if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= 800;
    return delta;
  }

  private applyCruiseImpulse(direction: 1 | -1, deltaPx: number): void {
    const mag = Math.min(Math.abs(deltaPx), 160);
    const impulse = (mag / 100) * DOLLY_CRUISE.impulsePer100px;
    // direction +1（上）→ Z を減らして潜る → 速度は負
    this.cruiseVelocityZ += direction > 0 ? -impulse : impulse;
    this.cruiseVelocityZ = clamp(
      this.cruiseVelocityZ,
      -DOLLY_CRUISE.maxSpeed,
      DOLLY_CRUISE.maxSpeed,
    );
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (!this.interactionEnabled) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      startTime: performance.now(),
      dragging: false,
    });
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.interactionEnabled) return;
    const p = this.pointers.get(e.pointerId);
    if (!p) return;

    const dx = e.clientX - p.lastX;
    const dy = e.clientY - p.lastY;
    const totalMove = Math.hypot(e.clientX - p.startX, e.clientY - p.startY);

    if (!p.dragging && totalMove >= TAP_THRESHOLD.maxMovePx) {
      p.dragging = true;
    }

    if (p.dragging && this.pointers.size === 1) {
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

    p.lastX = e.clientX;
    p.lastY = e.clientY;
  };

  private onPointerUp = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (!p) return;

    const duration = performance.now() - p.startTime;
    const move = Math.hypot(e.clientX - p.startX, e.clientY - p.startY);
    const wasTap =
      this.interactionEnabled &&
      !p.dragging &&
      move <= TAP_THRESHOLD.maxMovePx &&
      duration <= TAP_THRESHOLD.maxDurationMs;

    let reject: HitTestDebugSnapshot['tapRejectedReason'] = 'none';
    if (!this.interactionEnabled) reject = 'blocked';
    else if (p.dragging || move > TAP_THRESHOLD.maxMovePx) reject = 'drag';
    else if (duration > TAP_THRESHOLD.maxDurationMs) reject = 'duration';

    if (this.hitTestDebugEnabled || wasTap) {
      this.recordHitProbe(e.clientX, e.clientY, wasTap, reject);
    }

    if (wasTap) {
      this.handleTap(e.clientX, e.clientY);
    }
  };

  private recordHitProbe(
    clientX: number,
    clientY: number,
    wasTap: boolean,
    reject: HitTestDebugSnapshot['tapRejectedReason'],
  ): void {
    if (!this.renderer || !this.camera) return;
    const { candidates, chosen } = runRaycastHitTest(
      this.raycaster,
      this.camera,
      this.renderer.domElement,
      this.imageMeshes,
      clientX,
      clientY,
    );

    const snapshot: HitTestDebugSnapshot = {
      clientX,
      clientY,
      wasTap,
      tapRejectedReason: wasTap && !chosen ? 'noCandidate' : reject,
      hitCandidates: candidates,
      chosenImageId: chosen?.imageId ?? null,
      chosenDistance: chosen?.distance ?? null,
    };
    this.lastHitTestSnapshot = snapshot;
    this.lastRaycastCandidates = candidates.length;
    this.lastChosenId = chosen?.imageId ?? null;
    this.lastChosenDistance = chosen?.distance ?? null;
    this.callbacks.onHitTestSnapshot?.(snapshot);
  }

  private onWheel = (e: WheelEvent): void => {
    if (!this.interactionEnabled) return;
    e.preventDefault();

    const shift = e.shiftKey || this.shiftHeld;
    if (shift) {
      this.shiftHeld = true;
      const direction = this.resolveCruiseWheelDirection(e);
      if (direction) {
        this.applyCruiseImpulse(direction, this.normalizeWheelDeltaY(e));
      }
      return;
    }

    // 通常ホイール: 精密スクラブ（無限 wrap）。クルーズは素早く殺す
    this.cruiseVelocityZ *= Math.exp(-DOLLY_CRUISE.scrubCancelBrake * 0.05);

    let delta = e.deltaY;
    if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 16;
    if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= 800;

    // timeline 0–1 クランプではなく cameraZ を直接動かし wrap
    const zDelta = delta * 0.55 * CAMERA_CONFIG.wheelSensitivity;
    this.targetCameraZ -= zDelta;
    this.wrapDepthLoop();
    this.targetTimelinePosition = mapCameraZToTimeline(this.targetCameraZ);
  };

  private handleTap(clientX: number, clientY: number): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hits = this.raycaster
      .intersectObjects(this.imageMeshes, false)
      .filter((h) => {
        const mesh = h.object as THREE.Mesh;
        if (!mesh.userData?.isImageCard) return false;
        const alpha = mesh.userData.currentAlpha ?? 1;
        return alpha >= HIT_TEST_MIN_ALPHA && mesh.visible;
      });

    this.lastRaycastCandidates = hits.length;
    const chosen = hits[0];
    if (!chosen) {
      this.lastChosenId = null;
      this.lastChosenDistance = null;
      return;
    }

    const mesh = chosen.object as THREE.Mesh;
    const id = String(mesh.userData.imageId);
    const url = String(mesh.userData.imageUrl);
    this.lastChosenId = id;
    this.lastChosenDistance = chosen.distance;
    this.selectedImageId = id;
    this.callbacks.onImageTap({ id, url });
  }

  private emitStats(): void {
    const now = performance.now();
    if (now - this.lastStatsEmitMs < 200) return;
    this.lastStatsEmitMs = now;

    const stats: DebugStats = {
      demoId: 'DF',
      fps: this.fpsCounter.tick(),
      canvasCount: document.querySelectorAll('canvas').length,
      rendererType: 'Three.js WebGL',
      imageMeshCount: this.cards.length,
      textureCount: this.cards.length,
      cameraX: this.cameraX,
      cameraY: this.cameraY,
      cameraZ: this.cameraZ,
      targetCameraX: this.targetCameraX,
      targetCameraY: this.targetCameraY,
      targetCameraZ: this.targetCameraZ,
      timelinePosition: this.timelinePosition,
      targetTimelinePosition: this.targetTimelinePosition,
      cruiseVelocityZ: this.cruiseVelocityZ,
      cruiseActive: Math.abs(this.cruiseVelocityZ) > 8,
      shiftHeld: this.shiftHeld,
      cameraFov: this.camera.fov,
      visualPreset: this.visualConfig.presetId,
      hitTestDebugEnabled: this.hitTestDebugEnabled,
      wheelControls: 'infinite wrap · Shift=dolly cruise',
      dragControls: 'cameraX / cameraY',
      tapSelection: 'Raycaster',
      raycastCandidateCount: this.lastRaycastCandidates,
      chosenImageId: this.lastChosenId,
      chosenDistance: this.lastChosenDistance,
      selectedImageId: this.selectedImageId,
      overlayOpen: this.overlayOpen,
      drawerOpen: this.drawerOpen,
      interactionEnabled: this.interactionEnabled,
      realImageCount: this.assetResult.realImageCount,
      displayedImageCount: this.assetResult.displayedImageCount,
      duplicatedCount: this.assetResult.duplicatedCount,
      assetMode: this.assetResult.assetMode,
      warningCount: this.warnings.length,
    };

    this.callbacks.onStats(stats, [
      ...this.warnings,
      `cardMotion: idle+drift+loop  respawns: ${this.respawnCount}`,
    ]);
  }
}
