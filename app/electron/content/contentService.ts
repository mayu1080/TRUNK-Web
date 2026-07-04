import type { AssetIndex, Manifest, Category, Product } from '../../shared/types';
import { assertContentRootExists, resolveContentRoot, toFileUrl } from './contentRoot';
import { loadContentBundle, validateReferencedFiles } from './loaders';
import { buildAssetIndex } from './assetIndexBuilder';

export interface ContentService {
  contentRoot: string;
  manifest: Manifest;
  categories: Category[];
  products: Product[];
  assetIndex: AssetIndex;
}

let cached: ContentService | null = null;

export function initializeContentService(): ContentService {
  const contentRoot = resolveContentRoot();
  assertContentRootExists(contentRoot);

  const loaded = loadContentBundle(contentRoot);
  const warnings = validateReferencedFiles(
    contentRoot,
    loaded.manifest,
    loaded.categories,
    loaded.products,
  );
  const assetIndex = buildAssetIndex(contentRoot, loaded, warnings);

  cached = {
    contentRoot,
    manifest: loaded.manifest,
    categories: loaded.categories,
    products: loaded.products,
    assetIndex,
  };

  if (warnings.length > 0) {
    for (const w of warnings) {
      console.warn(`[content] ${w}`);
    }
  }

  console.info(
    `[content] loaded version=${assetIndex.version} listImages=${assetIndex.listImages.length} categories=${assetIndex.categories.length} products=${assetIndex.products.length}`,
  );

  return cached;
}

export function getContentService(): ContentService {
  if (!cached) {
    throw new Error('ContentService not initialized');
  }
  return cached;
}

export function getContentFileUrl(relativePath: string): string {
  const { contentRoot } = getContentService();
  return toFileUrl(contentRoot, relativePath);
}
