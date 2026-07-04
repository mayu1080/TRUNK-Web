import {
  Assets,
  ColorMatrixFilter,
  Container,
  Point,
  Sprite,
  Texture,
} from 'pixi.js';
import { WORLD_HEIGHT, WORLD_MARGIN, WORLD_WIDTH } from './constants';
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
import type { DemoListImage, ExploreView } from './types';

export interface PlacedImage {
  sprite: Sprite;
  meta: DemoListImage;
  display: ImageDisplayMetrics;
}

export interface ExploreScene {
  world: Container;
  images: PlacedImage[];
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

export async function buildExploreScene(images: DemoListImage[]): Promise<ExploreScene> {
  const loadStart = performance.now();
  const world = new Container();
  world.label = 'explore-world';

  const greyscale = new ColorMatrixFilter();
  greyscale.greyscale(0.45, false);
  world.filters = [greyscale];

  const rand = seededRandom(PLACEMENT_SEED);
  const placed: PlacedImage[] = [];
  const allMetrics: ImageDisplayMetrics[] = [];
  const textureSet = new Set<string>();
  let textureMemoryBytes = 0;

  const urls = images.map((img) => img.url);
  await Assets.load(urls);

  for (const meta of images) {
    const texture = Texture.from(meta.url);
    if (!textureSet.has(meta.url)) {
      textureSet.add(meta.url);
      textureMemoryBytes += estimateTextureBytes(texture);
    }

    const { width: texW, height: texH } = textureDimensions(texture);
    const preset = pickSizePreset(rand);
    const targetLongSide = pickTargetLongSide(preset, rand);
    const display = buildDisplayMetrics(texW, texH, targetLongSide, preset);

    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.scale.set(display.scale);

    const halfW = display.displayedWidth / 2;
    const halfH = display.displayedHeight / 2;
    const minX = WORLD_MARGIN + halfW;
    const maxX = WORLD_WIDTH - WORLD_MARGIN - halfW;
    const minY = WORLD_MARGIN + halfH;
    const maxY = WORLD_HEIGHT - WORLD_MARGIN - halfH;

    sprite.x = minX + rand() * Math.max(maxX - minX, 0);
    sprite.y = minY + rand() * Math.max(maxY - minY, 0);
    sprite.zIndex = Math.floor(rand() * 1000);

    sprite.label = meta.id;
    world.addChild(sprite);
    placed.push({ sprite, meta, display });
    allMetrics.push(display);
  }

  world.sortableChildren = true;
  world.sortChildren();

  const loadTimeMs = performance.now() - loadStart;

  return {
    world,
    images: placed,
    texturesLoaded: textureSet.size,
    textureMemoryBytes,
    loadTimeMs,
    displaySizeStats: aggregateDisplaySizeStats(allMetrics),
  };
}

export function applyExploreView(world: Container, view: ExploreView): void {
  world.position.set(view.panX, view.panY);
  world.scale.set(view.zoom);
}

/**
 * renderer 座標でヒットテスト。
 * world.toLocal で pan/zoom を反映し、zIndex 降順・表示サイズ AABB で判定する。
 */
export function hitTestImage(
  world: Container,
  images: PlacedImage[],
  rendererX: number,
  rendererY: number,
): PlacedImage | null {
  const local = world.toLocal(new Point(rendererX, rendererY));
  const sorted = [...images].sort((a, b) => b.sprite.zIndex - a.sprite.zIndex);

  for (const item of sorted) {
    const { sprite, display } = item;
    const halfW = display.displayedWidth / 2;
    const halfH = display.displayedHeight / 2;
    const dx = local.x - sprite.x;
    const dy = local.y - sprite.y;
    if (Math.abs(dx) <= halfW && Math.abs(dy) <= halfH) {
      return item;
    }
  }
  return null;
}

export function countDrawCallEstimate(imageCount: number, filterCount: number): number {
  return imageCount + filterCount;
}
