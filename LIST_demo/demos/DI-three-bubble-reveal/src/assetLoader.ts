import { getSelectionSeed, selectImagesForDisplay, TARGET_IMAGE_COUNT } from './imageSelection';
import type { AssetLoadResult, DemoAssetIndex, DemoListImage, ListImageEntry } from './types';

const DEMO_INDEX_URL = '/demo-asset-index.json';

const MOCK_SOURCE_PATHS = [
  'images/list/sample_list_01.svg',
  'images/list/sample_list_02.svg',
  'images/food/sample_food_01.svg',
  'images/gift/sample_gift_01.svg',
] as const;

function fileNameFromPath(relativePath: string): string {
  return relativePath.split('/').pop() ?? relativePath;
}

function toContentUrl(relativePath: string): string {
  return `/content/${relativePath.split('\\').join('/')}`;
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
    if (!res.ok) return null;
    return (await res.json()) as DemoAssetIndex;
  } catch {
    return null;
  }
}

async function loadFromDemoIndex(): Promise<AssetLoadResult | null> {
  const index = await fetchDemoAssetIndex();
  if (!index) return null;

  const seed = getSelectionSeed();
  const selection = selectImagesForDisplay(index, seed);
  if (selection.realImageCount === 0) return null;

  const images: DemoListImage[] = selection.images.map((img) => ({
    ...img,
    url: img.url?.startsWith('/content/') ? img.url : toContentUrl(img.relativePath),
  }));

  return {
    images,
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

async function loadFromMock(reason: string): Promise<AssetLoadResult> {
  const entries = expandEntries(
    MOCK_SOURCE_PATHS.map((relativePath, index) => ({
      id: `list_${String(index + 1).padStart(3, '0')}`,
      relativePath,
      fileName: fileNameFromPath(relativePath),
    })),
    TARGET_IMAGE_COUNT,
  );

  const images: DemoListImage[] = entries.map((entry, i) => ({
    ...entry,
    url: toContentUrl(entry.relativePath),
    duplicated: i >= MOCK_SOURCE_PATHS.length,
  }));

  return {
    images,
    warnings: [reason],
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

/** DD/DE と同じ: demo-asset-index → mock */
export async function loadListImages(): Promise<AssetLoadResult> {
  const fromIndex = await loadFromDemoIndex();
  if (fromIndex) return fromIndex;
  return loadFromMock(
    'content/images 配下に画像が見つからないため、mock assetIndex を使用しています。',
  );
}
