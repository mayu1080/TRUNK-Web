import { listConfig } from './listConfig';
import type { CardGenerationMode, DemoListCard } from './types';
import { createPlaceholderCards } from './three/placeholderCards';

export interface ExploreSourceImage {
  id: string;
  relativePath: string;
  fileName: string;
  categoryId?: string;
  title?: string;
  imageUrl: string;
}

export interface ContentCardLoadResult {
  cards: DemoListCard[];
  realImageCount: number;
  sourceImageCount: number;
  displayedImageCount: number;
  duplicatedCount: number;
  cardGenerationMode: CardGenerationMode;
  exploreSource: 'listImages' | 'recursive-images' | 'none';
  firstImageUrl: string | null;
  firstImageUrlScheme: string;
  contentError: string | null;
}

const CARD_EXPAND_SEED = listConfig.cardExpandSeed;

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  const rand = seededRandom(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function urlScheme(url: string | null): string {
  if (!url) return 'none';
  try {
    return new URL(url).protocol.replace(/:$/, '');
  } catch {
    if (url.startsWith('file:')) return 'file';
    const idx = url.indexOf('://');
    return idx > 0 ? url.slice(0, idx) : 'unknown';
  }
}

function expandToTarget(sources: ExploreSourceImage[], target: number): DemoListCard[] {
  const shuffled = seededShuffle(sources, CARD_EXPAND_SEED);
  const picked = shuffled.length > target ? shuffled.slice(0, target) : shuffled;
  const n = picked.length;
  const cards: DemoListCard[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < target; i++) {
    const src = picked[i % n]!;
    const duplicated = seen.has(src.id);
    seen.add(src.id);
    cards.push({
      instanceId: `card_${String(i + 1).padStart(3, '0')}`,
      sourceImageId: src.id,
      displayIndex: i,
      imageUrl: src.imageUrl,
      relativePath: src.relativePath,
      duplicated,
      categoryId: src.categoryId,
      title: src.title,
    });
  }

  return cards;
}

function fallbackResult(error: string): ContentCardLoadResult {
  const cards = createPlaceholderCards(listConfig.targetCardCount);
  return {
    cards,
    realImageCount: 0,
    sourceImageCount: 0,
    displayedImageCount: cards.length,
    duplicatedCount: 0,
    cardGenerationMode: 'fallback-placeholder',
    exploreSource: 'none',
    firstImageUrl: null,
    firstImageUrlScheme: 'none',
    contentError: error,
  };
}

/**
 * 1. getAssetIndex().listImages
 * 2. if empty, getExploreImages() (Main recursive scan of content/images)
 * 3. getContentFileUrl for each relativePath
 * 4. expand/cap to targetCardCount
 */
export async function loadContentCards(): Promise<ContentCardLoadResult> {
  const api = window.trunkApi;
  if (!api?.getAssetIndex || !api.getContentFileUrl) {
    return fallbackResult('trunkApi getAssetIndex / getContentFileUrl is not available');
  }

  try {
    const index = await api.getAssetIndex();
    let entries: Array<{
      id: string;
      relativePath: string;
      fileName: string;
      categoryId?: string;
      title?: string;
    }> = index.listImages ?? [];
    let exploreSource: ContentCardLoadResult['exploreSource'] =
      entries.length > 0 ? 'listImages' : 'none';

    if (api.getExploreImages) {
      const explore = await api.getExploreImages();
      if (explore.images.length > 0) {
        entries = explore.images;
        exploreSource = explore.source;
      }
    }

    if (entries.length === 0) {
      return fallbackResult(
        'content images: 0 (listImages empty and recursive scan found none)',
      );
    }

    const sources: ExploreSourceImage[] = [];
    for (const entry of entries) {
      const imageUrl = await api.getContentFileUrl(entry.relativePath);
      sources.push({
        id: entry.id,
        relativePath: entry.relativePath,
        fileName: entry.fileName,
        categoryId: entry.categoryId,
        title: entry.title ?? entry.fileName,
        imageUrl,
      });
    }

    const target = listConfig.targetCardCount;
    const cards = expandToTarget(sources, target);
    const duplicatedCount = cards.filter((c) => c.duplicated).length;
    const uniqueSources = new Set(cards.map((c) => c.sourceImageId)).size;
    const firstImageUrl = sources[0]?.imageUrl ?? null;
    console.info('[production] content cards', {
      exploreSource,
      realImageCount: sources.length,
      displayedImageCount: cards.length,
      duplicatedCount,
      firstImageUrlScheme: urlScheme(firstImageUrl),
      firstImageUrl,
    });

    return {
      cards,
      realImageCount: sources.length,
      sourceImageCount: uniqueSources,
      displayedImageCount: cards.length,
      duplicatedCount,
      cardGenerationMode: duplicatedCount > 0 ? 'content-duplicated' : 'content',
      exploreSource,
      firstImageUrl,
      firstImageUrlScheme: urlScheme(firstImageUrl),
      contentError: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[production] content card load failed', err);
    return fallbackResult(message);
  }
}
