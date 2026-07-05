import {
  Assets,
  ColorMatrixFilter,
  Container,
  Rectangle,
  Sprite,
  Texture,
} from 'pixi.js';
import type { VisualConfig } from '../visualConfig';
import {
  depthAlpha,
  depthScale,
  depthToLayer,
  layerParallaxOffset,
  parallaxCoeffForDepth,
} from './depthController';
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
import { computeIdleMotion, initIdleParams } from './idleMotion';

export interface PlacedImage {
  sprite: Sprite;
  meta: DemoListImage;
  display: ImageDisplayMetrics;
  depth: number;
  layerId: 'far' | 'mid' | 'near';
  baseX: number;
  baseY: number;
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
  renderOrder: number;
}

export interface HitTestCandidate {
  item: PlacedImage;
  imageId: string;
  depth: number;
  layerId: 'far' | 'mid' | 'near';
  zIndex: number;
  renderOrder: number;
  bounds: { x: number; y: number; w: number; h: number };
}

export interface ExploreScene {
  world: Container;
  layers: { far: Container; mid: Container; near: Container };
  images: PlacedImage[];
  contentBounds: ContentBounds;
  texturesLoaded: number;
  textureMemoryBytes: number;
  loadTimeMs: number;
  displaySizeStats: DisplaySizeStats;
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
 */
export function applyImageTone(
  filter: ColorMatrixFilter,
  config: VisualConfig,
  brightnessMul = 1,
): void {
  filter.reset();
  const { image } = config;

  if (!image.grayscale) {
    if (image.contrast !== 0.5) {
      filter.contrast(image.contrast, false);
    }
    const bright = image.brightness * brightnessMul;
    if (bright !== 1) {
      filter.brightness(bright, true);
    }
    return;
  }

  // multiply:true で連鎖 — false だと blackAndWhite が消えてカラーに戻る
  filter.blackAndWhite(false);
  filter.brightness(image.brightness * brightnessMul, true);
  filter.contrast(image.contrast, true);
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

  const layers = {
    far: new Container(),
    mid: new Container(),
    near: new Container(),
  };
  layers.far.label = 'layer-far';
  layers.mid.label = 'layer-mid';
  layers.near.label = 'layer-near';
  for (const layer of Object.values(layers)) {
    layer.eventMode = 'none';
    layer.interactiveChildren = false;
  }
  world.addChild(layers.far, layers.mid, layers.near);

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
    const dScale = config.depth.enabled ? depthScale(depth, config) : 1;
    const dAlpha = config.depth.enabled ? depthAlpha(depth, config) : 1;

    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.eventMode = 'none';
    sprite.hitArea = new Rectangle(-texW * 0.5, -texH * 0.5, texW, texH);
    const baseScale = display.scale * dScale;
    sprite.scale.set(baseScale);
    sprite.alpha = dAlpha * config.image.listAlpha;

    const greyFilter = new ColorMatrixFilter();
    applyImageTone(greyFilter, config);
    sprite.filters = [greyFilter];

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
    itemIndex += 1;

    contentPoints.push({ x: baseX, y: baseY, halfW, halfH });

    placedPoints.push({ x: baseX, y: baseY, group });
    sprite.x = baseX;
    sprite.y = baseY;
    sprite.zIndex = Math.floor(depth * 1000);

    sprite.label = meta.id;
    layers[layerId].addChild(sprite);
    layers[layerId].sortableChildren = true;
    layers[layerId].sortChildren();

    const layerBase = layerId === 'near' ? 20_000 : layerId === 'mid' ? 10_000 : 0;
    const renderOrder = layerBase + sprite.zIndex;

    placed.push({
      sprite,
      meta,
      display,
      depth,
      layerId,
      baseX,
      baseY,
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
      renderOrder,
    });
    const placedItem = placed[placed.length - 1]!;
    initIdleParams(placedItem, rand, MOTION_CONFIG);
    allMetrics.push(display);
  }

  const loadTimeMs = performance.now() - loadStart;
  const contentBounds = computeContentBounds(contentPoints, config.world.contentPadding);

  return {
    world,
    layers,
    images: placed,
    contentBounds,
    texturesLoaded: textureSet.size,
    textureMemoryBytes,
    loadTimeMs,
    displaySizeStats: aggregateDisplaySizeStats(allMetrics),
  };
}

export function applyVisualConfigToScene(scene: ExploreScene, config: VisualConfig): void {
  for (const item of scene.images) {
    applyImageTone(item.greyFilter, config);
    const dScale = config.depth.enabled ? depthScale(item.depth, config) : 1;
    const dAlpha = config.depth.enabled ? depthAlpha(item.depth, config) : 1;
    item.sprite.alpha = dAlpha * config.image.listAlpha;
    item.baseScale = item.display.scale * dScale;
  }
}

export function applyExploreView(
  scene: ExploreScene,
  view: ExploreView,
  config: VisualConfig,
  time: number,
): void {
  worldTransform(scene, view, config);

  const useIdle = MOTION_CONFIG.idle.enabled;

  for (const item of scene.images) {
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

    item.sprite.x = item.baseX + item.reactionOffsetX + idleX;
    item.sprite.y = item.baseY + item.reactionOffsetY + idleY;
    item.sprite.rotation = idleRot;

    const totalScale =
      item.baseScale * item.reactionScale * item.tapFocusScale * idleScaleMul;
    item.sprite.scale.set(totalScale);

    if (item.tapFocusBright !== 1) {
      applyImageTone(item.greyFilter, config, item.tapFocusBright);
    }
  }
}

function worldTransform(scene: ExploreScene, view: ExploreView, config: VisualConfig): void {
  scene.world.position.set(view.panX, view.panY);
  scene.world.scale.set(view.zoom);

  if (!config.depth.enabled) {
    scene.layers.far.position.set(0, 0);
    scene.layers.mid.position.set(0, 0);
    scene.layers.near.position.set(0, 0);
    return;
  }

  const strength = config.depth.parallaxStrength;
  const coeffs = {
    far: config.depth.parallaxFar,
    mid: config.depth.parallaxMid,
    near: config.depth.parallaxNear,
  };

  for (const id of ['far', 'mid', 'near'] as const) {
    const off = layerParallaxOffset(view.panX, view.panY, coeffs[id], strength);
    scene.layers[id].position.set(off.x / view.zoom, off.y / view.zoom);
  }

  void parallaxCoeffForDepth;
}

/** 最終表示 bounds（float / parallax / rotation / scale 反映後）でヒット候補を列挙 */
export function hitTestCandidates(
  images: PlacedImage[],
  rendererX: number,
  rendererY: number,
): HitTestCandidate[] {
  const px = rendererX;
  const py = rendererY;
  const hits: HitTestCandidate[] = [];

  for (const item of images) {
    const { sprite } = item;
    const b = sprite.getBounds();
    if (px < b.minX || px > b.maxX || py < b.minY || py > b.maxY) continue;
    hits.push({
      item,
      imageId: item.meta.id,
      depth: item.depth,
      layerId: item.layerId,
      zIndex: sprite.zIndex,
      renderOrder: item.renderOrder,
      bounds: {
        x: b.minX,
        y: b.minY,
        w: b.maxX - b.minX,
        h: b.maxY - b.minY,
      },
    });
  }

  hits.sort((a, b) => b.renderOrder - a.renderOrder);
  return hits;
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
