import {
  MAX_IMAGE_COUNT,
  MOCK_SOURCE_PATHS,
  TARGET_IMAGE_COUNT,
} from './constants';
import { getSelectionSeed, selectImagesForDisplay } from './imageSelection';
import type {
  AssetLoadResult,
  DemoAssetIndex,
  DemoListImage,
  ListImageEntry,
} from './types';

const DEMO_INDEX_URL = '/demo-asset-index.json';

function fileNameFromPath(relativePath: string): string {
  return relativePath.split('/').pop() ?? relativePath;
}

function toContentUrl(relativePath: string): string {
  return `/content/${relativePath.split('\\').join('/')}`;
}

async function loadFromTrunkApi(): Promise<AssetLoadResult | null> {
  if (typeof window === 'undefined' || !window.trunkApi) {
    return null;
  }

  try {
    const index = await window.trunkApi.getAssetIndex();
    const warnings = [...index.warnings];
    let entries = index.listImages;

    if (entries.length === 0) {
      warnings.push('trunkApi: listImages が空です。demo-index にフォールバックします。');
      return null;
    }

    const realImageCount = entries.length;
    let duplicatedCount = 0;

    if (entries.length < TARGET_IMAGE_COUNT) {
      warnings.push(
        `trunkApi: listImages は ${entries.length} 枚です。${TARGET_IMAGE_COUNT} 枚に複製して負荷検証します。`,
      );
      entries = expandEntries(entries, TARGET_IMAGE_COUNT);
      duplicatedCount = TARGET_IMAGE_COUNT - realImageCount;
    } else if (entries.length > MAX_IMAGE_COUNT) {
      warnings.push(`trunkApi: ${entries.length} 枚のうち先頭 ${MAX_IMAGE_COUNT} 枚のみ使用します。`);
      entries = entries.slice(0, MAX_IMAGE_COUNT);
    }

    const images: DemoListImage[] = await Promise.all(
      entries.map(async (entry, i) => {
        const duplicated = i >= realImageCount;
        const url = await window.trunkApi!.getContentFileUrl(entry.relativePath);
        return {
          ...entry,
          url,
          duplicated,
        };
      }),
    );

    return {
      images,
      warnings,
      source: 'trunkApi',
      assetMode: 'trunkApi',
      sourceRoot: 'preload',
      scannedFolders: [],
      includeDirs: [],
      excludeDirs: [],
      realImageCount,
      displayedImageCount: images.length,
      duplicatedCount,
      selectionSeed: null,
    };
  } catch (err) {
    console.warn('[assetAdapter] trunkApi failed, falling back to demo-index', err);
    return null;
  }
}

function expandEntries(entries: ListImageEntry[], target: number): ListImageEntry[] {
  if (entries.length === 0) return entries;
  const result: ListImageEntry[] = [];
  for (let i = 0; i < target; i++) {
    const src = entries[i % entries.length]!;
    result.push({
      id: `${src.id}__dup${String(i + 1).padStart(3, '0')}`,
      relativePath: src.relativePath,
      fileName: src.fileName,
    });
  }
  return result;
}

async function fetchDemoAssetIndex(): Promise<DemoAssetIndex | null> {
  try {
    const res = await fetch(DEMO_INDEX_URL, { cache: 'no-store' });
    if (!res.ok) {
      console.warn(`[assetAdapter] ${DEMO_INDEX_URL} → ${res.status}`);
      return null;
    }
    return (await res.json()) as DemoAssetIndex;
  } catch (err) {
    console.warn('[assetAdapter] demo-asset-index fetch failed', err);
    return null;
  }
}

async function loadFromDemoIndex(): Promise<AssetLoadResult | null> {
  const index = await fetchDemoAssetIndex();
  if (!index) return null;

  const seed = getSelectionSeed();
  const selection = selectImagesForDisplay(index, seed);

  if (selection.realImageCount === 0) {
    return null;
  }

  return {
    images: selection.images,
    warnings: selection.warnings,
    source: 'demo-index',
    assetMode: index.mode,
    sourceRoot: index.root,
    scannedFolders: index.folders,
    includeDirs: index.includeDirs,
    excludeDirs: index.excludeDirs,
    realImageCount: selection.realImageCount,
    displayedImageCount: selection.displayedImageCount,
    duplicatedCount: selection.duplicatedCount,
    selectionSeed: selection.selectionSeed,
  };
}

function buildMockEntries(): ListImageEntry[] {
  const base = MOCK_SOURCE_PATHS.map((relativePath, index) => ({
    id: `list_${String(index + 1).padStart(3, '0')}`,
    relativePath,
    fileName: fileNameFromPath(relativePath),
  }));
  return expandEntries(base, TARGET_IMAGE_COUNT);
}

async function loadFromMock(reason: string): Promise<AssetLoadResult> {
  const warnings: string[] = [
    reason,
    `content/ のサンプル ${MOCK_SOURCE_PATHS.length} 種を複製し、${TARGET_IMAGE_COUNT} 枚で負荷検証しています。`,
  ];

  const entries = buildMockEntries();
  const images: DemoListImage[] = entries.map((entry, i) => ({
    ...entry,
    url: toContentUrl(entry.relativePath),
    duplicated: i >= MOCK_SOURCE_PATHS.length,
    categoryId: 'mock',
    sourceFolder: 'mock',
  }));

  return {
    images,
    warnings,
    source: 'mock',
    assetMode: 'mock-fallback',
    sourceRoot: 'content/samples',
    scannedFolders: [],
    includeDirs: [],
    excludeDirs: [],
    realImageCount: MOCK_SOURCE_PATHS.length,
    displayedImageCount: images.length,
    duplicatedCount: images.length - MOCK_SOURCE_PATHS.length,
    selectionSeed: null,
  };
}

/**
 * 優先1: trunkApi → 優先2: demo-asset-index.json → 優先3: mock
 */
export async function loadListImages(): Promise<AssetLoadResult> {
  const fromApi = await loadFromTrunkApi();
  if (fromApi) return fromApi;

  const fromIndex = await loadFromDemoIndex();
  if (fromIndex) return fromIndex;

  return loadFromMock(
    'content/images 配下に画像が見つからないため、mock assetIndex を使用しています。',
  );
}
