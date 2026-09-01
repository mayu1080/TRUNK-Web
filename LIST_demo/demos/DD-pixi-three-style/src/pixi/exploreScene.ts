import {
  Assets,
  BlurFilter,
  ColorMatrixFilter,
  Container,
  Rectangle,
  Sprite,
  Texture,
} from 'pixi.js';
import { SOFT_TINT_RGB, type VisualConfig } from '../visualConfig';
import { depthAlpha, depthScale, depthToLayer } from './depthController';
import {
  aggregateDisplaySizeStats,
  buildDisplayMetrics,
  pickSizePreset,
  pickTargetLongSide,
  PLACEMENT_SEED,
  seededRandom,
  type DisplaySizeStats,
  type ImageDisplayMetrics,
} from './imageSizing';
import {
  buildGroupIndexMap,
  findSpreadPosition,
  getPlacementGroup,
  interleaveByGroup,
  makePlacementBounds,
  type PlacedPoint,
} from './spreadPlacement';
import type { ContentBounds } from './worldBounds';
import { computeContentBounds } from './worldBounds';
import type { DemoListImage, ExploreView } from './types';
import { MOTION_CONFIG } from '../motionConfig';
import {
  applyDepthBlur,
  createDepthBlurFilter,
  initDepthFlowParams,
  integrateDepthFlow,
} from './depthFlowMotion';
import { getCameraZ, isCameraNavigationMode, updateSceneTimeScale } from './cameraDepth';
import { computeCameraLookAt, computeCameraProjection, integrateSceneZDrift } from './cameraDepthMotion';
import { computeIdleMotion, initIdleParams } from './idleMotion';

export interface PlacedImage {
  sprite: Sprite;
  meta: DemoListImage;
  display: ImageDisplayMetrics;
  /** 配置時の初期 depth（デバッグ用） */
  depth: number;
  /** デバッグ用ラベル — flowDepth から毎フレーム更新（4段階 or legacy 3段階） */
  layerId: 'far' | 'mid' | 'near' | 'midFar' | 'midNear';
  flowDepth: number;
  /** @deprecated E-2 では sceneZ を使用 */
  imageDepth: number;
  flowSpeed: number;
  /** speedVariance 由来の個体差（baseSpeed×multiplier に加算） */
  flowSpeedVariance: number;
  flowDirX: number;
  flowDirY: number;
  flowMotionDistance: number;
  stableIndex: number;
  baseX: number;
  baseY: number;
  /** E-2: 空間内固定座標 */
  sceneX: number;
  sceneY: number;
  sceneZ: number;
  /** E-2: sceneZ ドリフト個体差倍率 */
  sceneZDriftMul: number;
  lastRelativeZ: number;
  lastPerspective: number;
  baseScale: number;
  floatPhase: number;
  floatSpeed: number;
  idleIntensity: number;
  idleSpeed: number;
  idlePhaseX: number;
  idlePhaseY: number;
  idlePhaseScale: number;
  idlePhaseRot: number;
  reactionScale: number;
  reactionOffsetX: number;
  reactionOffsetY: number;
  tapFocusScale: number;
  tapFocusBright: number;
  greyFilter: ColorMatrixFilter;
  blurFilter: BlurFilter;
  renderOrder: number;
}

export interface HitTestCandidate {
  item: PlacedImage;
  imageId: string;
  depth: number;
  layerId: 'far' | 'mid' | 'near' | 'midFar' | 'midNear';
  zIndex: number;
  renderOrder: number;
  alpha: number;
  bounds: { x: number; y: number; w: number; h: number };
}

export interface HitTestFilterStats {
  beforeFilter: number;
  afterVisibility: number;
  afterAlpha: number;
  afterBounds: number;
  final: number;
}

export interface ExploreScene {
  world: Container;
  /** 全探索画像の単一親 — パララックス / reparent なし */
  imageContainer: Container;
  images: PlacedImage[];
  contentBounds: ContentBounds;
  texturesLoaded: number;
  textureMemoryBytes: number;
  loadTimeMs: number;
  displaySizeStats: DisplaySizeStats;
  /** depth flow ループ respawn 累計 */
  depthFlowRespawnCount: number;
}

function estimateTextureBytes(texture: Texture): number {
  const src = texture.source;
  const w = src?.width ?? texture.width ?? 0;
  const h = src?.height ?? texture.height ?? 0;
  return w * h * 4;
}

function textureDimensions(texture: Texture): { width: number; height: number } {
  const w = texture.orig?.width ?? texture.width ?? texture.source?.width ?? 1;
  const h = texture.orig?.height ?? texture.height ?? texture.source?.height ?? 1;
  return { width: w, height: h };
}

/**
 * 画像 Sprite のみに適用する LIST トーン（ワールド／背景には掛けない）
 * Pixi v8 contrast: 0.5=標準、下げるとシャドウ持ち上げ＋白飛び抑制
 *
 * soft-tint: DF 相当 — ITU-R BT.601 輝度灰 × 暖色ティント（bright/contrast マトリクスは使わない）
 */
export function applyImageTone(
  filter: ColorMatrixFilter,
  config: VisualConfig,
  brightnessMul = 1,
  contrastMul = 1,
): void {
  filter.reset();
  const { image } = config;

  if (image.toneMode === 'soft-tint' && image.grayscale) {
    const tint = image.tintRgb ?? SOFT_TINT_RGB;
    const lr = 0.299;
    const lg = 0.587;
    const lb = 0.114;
    const b = image.brightness * brightnessMul;
    // gray = dot(rgb, luma); then rgb = gray * tint * brightness
    filter.matrix = [
      lr * tint.r * b, lg * tint.r * b, lb * tint.r * b, 0, 0,
      lr * tint.g * b, lg * tint.g * b, lb * tint.g * b, 0, 0,
      lr * tint.b * b, lg * tint.b * b, lb * tint.b * b, 0, 0,
      0, 0, 0, 1, 0,
    ];
    return;
  }

  const contrast = image.contrast * contrastMul;

  if (!image.grayscale) {
    if (contrast !== 0.5) {
      filter.contrast(contrast, false);
    }
    const bright = image.brightness * brightnessMul;
    if (bright !== 1) {
      filter.brightness(bright, true);
    }
    return;
  }

  filter.blackAndWhite(false);
  filter.brightness(image.brightness * brightnessMul, true);
  filter.contrast(contrast, true);
}

export async function buildExploreScene(
  images: DemoListImage[],
  config: VisualConfig,
): Promise<ExploreScene> {
  const loadStart = performance.now();
  const world = new Container();
  world.label = 'dd-explore-world';
  world.eventMode = 'none';
  world.interactiveChildren = false;

  const imageContainer = new Container();
  imageContainer.label = 'dd-image-container';
  imageContainer.eventMode = 'none';
  imageContainer.interactiveChildren = false;
  imageContainer.sortableChildren = true;
  world.addChild(imageContainer);

  const rand = seededRandom(PLACEMENT_SEED);
  const orderedImages = interleaveByGroup(images, PLACEMENT_SEED + 17);
  const groupIndexMap = buildGroupIndexMap(images);
  const groupCount = groupIndexMap.size;
  const placedPoints: PlacedPoint[] = [];
  const placed: PlacedImage[] = [];
  const allMetrics: ImageDisplayMetrics[] = [];
  const textureSet = new Set<string>();
  let textureMemoryBytes = 0;

  const urls = images.map((img) => img.url);
  await Assets.load(urls);

  const totalCount = orderedImages.length;
  let itemIndex = 0;
  const contentPoints: { x: number; y: number; halfW: number; halfH: number }[] = [];
  const useDepthFlow = MOTION_CONFIG.depthFlow.enabled;

  for (const meta of orderedImages) {
    const texture = Texture.from(meta.url);
    if (!textureSet.has(meta.url)) {
      textureSet.add(meta.url);
      textureMemoryBytes += estimateTextureBytes(texture);
    }

    const { width: texW, height: texH } = textureDimensions(texture);
    const preset = pickSizePreset(rand);
    const targetLongSide = pickTargetLongSide(preset, rand);
    const display = buildDisplayMetrics(texW, texH, targetLongSide, preset);

    const depth = rand();
    const layerId = depthToLayer(depth);
    const dScale =
      config.depth.enabled && !useDepthFlow ? depthScale(depth, config) : 1;
    const dAlpha =
      config.depth.enabled && !useDepthFlow ? depthAlpha(depth, config) : 1;

    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.eventMode = 'none';
    sprite.hitArea = new Rectangle(-texW * 0.5, -texH * 0.5, texW, texH);
    const baseScale = display.scale * dScale;
    sprite.scale.set(baseScale);
    sprite.alpha = dAlpha * config.image.listAlpha;

    const greyFilter = new ColorMatrixFilter();
    applyImageTone(greyFilter, config);
    const blurFilter = createDepthBlurFilter();
    sprite.filters = useDepthFlow ? [greyFilter, blurFilter] : [greyFilter];

    const halfW = (display.displayedWidth * dScale) / 2;
    const halfH = (display.displayedHeight * dScale) / 2;
    const bounds = makePlacementBounds(halfW, halfH, config.world);
    const group = getPlacementGroup(meta);
    const groupIndex = groupIndexMap.get(group) ?? 0;
    const { x: baseX, y: baseY } = findSpreadPosition(
      itemIndex,
      totalCount,
      group,
      groupIndex,
      groupCount,
      bounds,
      placedPoints,
      config.placement,
      rand,
    );

    contentPoints.push({ x: baseX, y: baseY, halfW, halfH });
    placedPoints.push({ x: baseX, y: baseY, group });
    sprite.x = baseX;
    sprite.y = baseY;
    sprite.label = meta.id;

    const stableIndex = itemIndex;
    const renderOrder = Math.round(depth * 10_000) + stableIndex;
    sprite.zIndex = renderOrder;

    imageContainer.addChild(sprite);
    itemIndex += 1;

    const placedItem: PlacedImage = {
      sprite,
      meta,
      display,
      depth,
      layerId,
      flowDepth: depth,
      imageDepth: depth,
      flowSpeed: 0,
      flowSpeedVariance: 0,
      flowDirX: 0,
      flowDirY: -1,
      flowMotionDistance: 0,
      stableIndex,
      baseX,
      baseY,
      sceneX: baseX,
      sceneY: baseY,
      sceneZ: 0,
      sceneZDriftMul: 1,
      lastRelativeZ: 0,
      lastPerspective: 1,
      baseScale,
      floatPhase: rand() * Math.PI * 2,
      floatSpeed: 0.7 + rand() * 0.6,
      idleIntensity: 0,
      idleSpeed: 0,
      idlePhaseX: 0,
      idlePhaseY: 0,
      idlePhaseScale: 0,
      idlePhaseRot: 0,
      reactionScale: 1,
      reactionOffsetX: 0,
      reactionOffsetY: 0,
      tapFocusScale: 1,
      tapFocusBright: 1,
      greyFilter,
      blurFilter,
      renderOrder,
    };
    placed.push(placedItem);
    initIdleParams(placedItem, rand, MOTION_CONFIG);
    initDepthFlowParams(placedItem, rand, MOTION_CONFIG);
    placedItem.sceneX = baseX;
    placedItem.sceneY = baseY;
    placedItem.imageDepth = placedItem.sceneZ;
    allMetrics.push(display);
  }

  imageContainer.sortChildren();

  const loadTimeMs = performance.now() - loadStart;
  const contentBounds = computeContentBounds(contentPoints, config.world.contentPadding);

  return {
    world,
    imageContainer,
    images: placed,
    contentBounds,
    texturesLoaded: textureSet.size,
    textureMemoryBytes,
    loadTimeMs,
    displaySizeStats: aggregateDisplaySizeStats(allMetrics),
    depthFlowRespawnCount: 0,
  };
}

export function applyVisualConfigToScene(scene: ExploreScene, config: VisualConfig): void {
  const useDepthFlow = MOTION_CONFIG.depthFlow.enabled;
  for (const item of scene.images) {
    const dScale =
      config.depth.enabled && !useDepthFlow ? depthScale(item.depth, config) : 1;
    const dAlpha =
      config.depth.enabled && !useDepthFlow ? depthAlpha(item.depth, config) : 1;
    item.baseScale = item.display.scale * dScale;
    if (!useDepthFlow) {
      applyImageTone(item.greyFilter, config);
      item.sprite.alpha = dAlpha * config.image.listAlpha;
    }
  }
}

export function applyExploreView(
  scene: ExploreScene,
  view: ExploreView,
  config: VisualConfig,
  time: number,
  deltaTime = 0,
  viewport?: { width: number; height: number },
): void {
  if (isCameraNavigationMode()) {
    applyCameraExploreView(scene, view, config, time, deltaTime, viewport);
    return;
  }

  applyObjectFlowExploreView(scene, view, config, time, deltaTime);
}

/** E-2 — 疑似3Dカメラ + sceneZ ドリフト */
function applyCameraExploreView(
  scene: ExploreScene,
  view: ExploreView,
  config: VisualConfig,
  time: number,
  deltaTime: number,
  viewport?: { width: number; height: number },
): void {
  worldTransform(scene, view);
  updateSceneTimeScale(deltaTime);

  const cameraZ = getCameraZ();
  const vpW = viewport?.width ?? 1920;
  const vpH = viewport?.height ?? 1080;
  const { cameraX, cameraY } = computeCameraLookAt(view.panX, view.panY, view.zoom, vpW, vpH);
  const useIdle = MOTION_CONFIG.idle.enabled;

  for (const item of scene.images) {
    integrateSceneZDrift(item, cameraZ, deltaTime, scene, config, MOTION_CONFIG);

    const proj = computeCameraProjection(item, cameraX, cameraY, cameraZ, MOTION_CONFIG);
    item.lastRelativeZ = proj.relativeZ;
    item.lastPerspective = proj.perspective;
    item.layerId = proj.depthLabel;
    item.renderOrder = proj.renderOrder;
    item.sprite.zIndex = proj.renderOrder;
    item.flowDepth = 0;
    item.depth = clamp01(1 - proj.relativeZ / MOTION_CONFIG.cameraDepth.farFadeStart);

    let idleX = 0;
    let idleY = 0;
    let idleScaleMul = 1;
    let idleRot = 0;

    if (useIdle) {
      const idle = computeIdleMotion(item, time, MOTION_CONFIG, proj.relativeZ);
      idleX = idle.offsetX;
      idleY = idle.offsetY;
      idleScaleMul = idle.scaleMul;
      idleRot = idle.rotation;
    }

    item.sprite.x = proj.screenX + item.reactionOffsetX + idleX;
    item.sprite.y = proj.screenY + item.reactionOffsetY + idleY;
    item.sprite.rotation = idleRot;

    const totalScale =
      item.baseScale *
      proj.scaleMul *
      item.reactionScale *
      item.tapFocusScale *
      idleScaleMul;
    item.sprite.scale.set(totalScale);

    const brightMul = item.tapFocusBright !== 1 ? item.tapFocusBright : proj.brightnessMul;
    applyImageTone(item.greyFilter, config, brightMul, proj.contrastMul);
    item.sprite.alpha = proj.alphaMul * config.image.listAlpha;
    applyDepthBlur(item.blurFilter, proj.blurStrength);
  }

  scene.imageContainer.sortChildren();
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** E — object-flow */
function applyObjectFlowExploreView(
  scene: ExploreScene,
  view: ExploreView,
  config: VisualConfig,
  time: number,
  deltaTime = 0,
): void {
  worldTransform(scene, view);

  const useIdle = MOTION_CONFIG.idle.enabled;
  const useDepthFlow = MOTION_CONFIG.depthFlow.enabled;
  let needsSort = false;

  for (const item of scene.images) {
    const flow = integrateDepthFlow(item, scene, deltaTime, config, MOTION_CONFIG);
    item.flowDepth = flow.flowDepth;
    item.layerId = flow.depthLabel;
    item.renderOrder = flow.renderOrder;
    item.sprite.zIndex = flow.renderOrder;
    needsSort = true;

    let idleX = 0;
    let idleY = 0;
    let idleScaleMul = 1;
    let idleRot = 0;

    if (useIdle) {
      const idle = computeIdleMotion(item, time, MOTION_CONFIG);
      idleX = idle.offsetX;
      idleY = idle.offsetY;
      idleScaleMul = idle.scaleMul;
      idleRot = idle.rotation;
    } else if (config.float.enabled) {
      idleY =
        Math.sin(time * config.float.speed * item.floatSpeed + item.floatPhase) *
        config.float.amplitudeY;
      idleRot =
        Math.sin(time * config.float.speed * 0.7 + item.floatPhase) *
        config.float.amplitudeRot;
    }

    item.sprite.x = item.baseX + item.reactionOffsetX + idleX + flow.offsetX;
    item.sprite.y = item.baseY + item.reactionOffsetY + idleY + flow.offsetY;
    item.sprite.rotation = idleRot;

    const depthScaleMul = useDepthFlow ? flow.scaleMul : 1;
    const totalScale =
      item.baseScale * depthScaleMul * item.reactionScale * item.tapFocusScale * idleScaleMul;
    item.sprite.scale.set(totalScale);

    const brightMul =
      (item.tapFocusBright !== 1 ? item.tapFocusBright : 1) *
      (useDepthFlow ? flow.brightnessMul : 1);
    const contrastMul = useDepthFlow ? flow.contrastMul : 1;
    if (useDepthFlow || item.tapFocusBright !== 1) {
      applyImageTone(item.greyFilter, config, brightMul, contrastMul);
    }

    if (useDepthFlow) {
      item.sprite.alpha = flow.alphaMul * config.image.listAlpha;
      applyDepthBlur(item.blurFilter, flow.blurStrength);
      item.depth = flow.flowDepth;
    }
  }

  if (needsSort && useDepthFlow) {
    scene.imageContainer.sortChildren();
  }
}
function worldTransform(scene: ExploreScene, view: ExploreView): void {
  scene.world.position.set(view.panX, view.panY);
  scene.world.scale.set(view.zoom);
}

/** 最終表示の画像矩形でヒット候補を列挙（BlurFilter padding 除外） */
export function hitTestCandidates(
  images: PlacedImage[],
  rendererX: number,
  rendererY: number,
): HitTestCandidate[] {
  return hitTestCandidatesDetailed(images, rendererX, rendererY).candidates;
}

export function hitTestCandidatesDetailed(
  images: PlacedImage[],
  rendererX: number,
  rendererY: number,
): { candidates: HitTestCandidate[]; stats: HitTestFilterStats } {
  const px = rendererX;
  const py = rendererY;
  const hits: HitTestCandidate[] = [];

  const minAlpha = isCameraNavigationMode()
    ? MOTION_CONFIG.cameraDepth.hitTestMinAlpha
    : MOTION_CONFIG.depthFlow.hitTestMinAlpha;

  let afterVisibility = 0;
  let afterAlpha = 0;

  for (const item of images) {
    const { sprite } = item;
    if (!sprite.visible) continue;
    afterVisibility += 1;

    // alpha しきい値のみ（relativeZ ゲートは外し、渋さを解消）
    if (sprite.alpha < minAlpha) continue;
    afterAlpha += 1;

    const b = getSpriteHitBounds(sprite);
    if (px < b.minX || px > b.maxX || py < b.minY || py > b.maxY) continue;
    hits.push({
      item,
      imageId: item.meta.id,
      depth: isCameraNavigationMode() ? item.lastRelativeZ : item.flowDepth,
      layerId: item.layerId,
      zIndex: sprite.zIndex,
      renderOrder: item.renderOrder,
      alpha: sprite.alpha,
      bounds: {
        x: b.minX,
        y: b.minY,
        w: b.maxX - b.minX,
        h: b.maxY - b.minY,
      },
    });
  }

  hits.sort((a, b) => b.renderOrder - a.renderOrder);

  return {
    candidates: hits,
    stats: {
      beforeFilter: images.length,
      afterVisibility,
      afterAlpha,
      afterBounds: hits.length,
      final: hits.length,
    },
  };
}

/**
 * 見た目の画像矩形（BlurFilter padding を含めない）。
 * getBounds() はブラーで膨張するため、worldTransform の 4 隅 AABB を使う。
 */
function getSpriteHitBounds(sprite: Sprite): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  const local = sprite.getLocalBounds();
  const wt = sprite.worldTransform;
  const x0 = local.x;
  const y0 = local.y;
  const x1 = local.x + local.width;
  const y1 = local.y + local.height;

  const corners = [
    wt.apply({ x: x0, y: y0 }),
    wt.apply({ x: x1, y: y0 }),
    wt.apply({ x: x1, y: y1 }),
    wt.apply({ x: x0, y: y1 }),
  ];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of corners) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, maxX, minY, maxY };
}

/** 最前面候補を採用（renderOrder 降順） */
export function pickFrontCandidate(
  candidates: HitTestCandidate[],
): HitTestCandidate | null {
  return candidates[0] ?? null;
}

export function hitTestImage(
  _world: Container,
  images: PlacedImage[],
  rendererX: number,
  rendererY: number,
): PlacedImage | null {
  const chosen = pickFrontCandidate(hitTestCandidates(images, rendererX, rendererY));
  return chosen?.item ?? null;
}

export function countDrawCallEstimate(imageCount: number, filterCount: number): number {
  return imageCount + filterCount;
}
