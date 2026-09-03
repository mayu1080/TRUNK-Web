import type {
  AssetIndex,
  ExploreImageSet,
  Manifest,
  Category,
  Product,
  ContentImageValidationReport,
  CategoryGallery,
  SharedCopy,
} from '../../shared/types';
import fs from 'node:fs';
import { assertContentRootExists, resolveContentPath, resolveContentRoot } from './contentRoot';
import { loadContentBundle, validateReferencedFiles } from './loaders';
import { buildAssetIndex } from './assetIndexBuilder';
import { collectExploreImages, scanImagesRecursive } from './exploreImageCollector';
import { toContentRenderUrl } from './contentProtocol';
import { validateProductionContentImages } from './contentImageValidation';
import { buildCategoryGallery } from './categoryGallery';
import { loadSharedCopy } from './sharedCopy';

export interface ContentService {
  contentRoot: string;
  manifest: Manifest;
  categories: Category[];
  products: Product[];
  assetIndex: AssetIndex;
  imageValidation: ContentImageValidationReport;
  sharedCopy: SharedCopy;
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
  const recursiveImages = scanImagesRecursive(contentRoot);
  const explore = collectExploreImages(contentRoot, assetIndex.listImages);
  const imageValidation = validateProductionContentImages(contentRoot, loaded.categories);
  const sharedCopy = loadSharedCopy(contentRoot);

  cached = {
    contentRoot,
    manifest: loaded.manifest,
    categories: loaded.categories,
    products: loaded.products,
    assetIndex,
    imageValidation,
    sharedCopy,
  };

  if (warnings.length > 0) {
    for (const w of warnings) {
      console.warn(`[content] ${w}`);
    }
  }

  const imagesDir = resolveContentPath(contentRoot, 'images');
  let imageChildren = '(missing)';
  try {
    imageChildren = fs.readdirSync(imagesDir).join(', ');
  } catch (err) {
    imageChildren = `<unreadable: ${err instanceof Error ? err.message : String(err)}>`;
  }
  const sample = explore.images[0];
  console.info(`[content] contentRoot=${contentRoot}`);
  console.info(`[content] imagesDir=${imagesDir} exists=${fs.existsSync(imagesDir)} children=${imageChildren}`);
  console.info(
    `[content] listImages=${assetIndex.listImages.length} recursiveImages=${recursiveImages.length} exploreImages=${explore.images.length} exploreSource=${explore.source}`,
  );
  if (sample) {
    console.info(
      `[content] sampleRelativePath=${sample.relativePath} sampleUrl=${toContentRenderUrl(sample.relativePath)}`,
    );
  }
  console.info(
    `[content] loaded version=${assetIndex.version} categories=${assetIndex.categories.length} products=${assetIndex.products.length}`,
  );
  logImageValidation(imageValidation);
  if (sharedCopy.found) {
    console.info(`[content] sharedCopy=${sharedCopy.relativePath} title=${JSON.stringify(sharedCopy.title)}`);
  } else {
    console.warn(`[content] sharedCopy missing: ${sharedCopy.warning}`);
  }

  return cached;
}

function logImageValidation(report: ContentImageValidationReport): void {
  console.info(
    `[content-validation] source=${report.exploreSource} sourceImageCount=${report.sourceImageCount} expectedDisplayed=${report.expectedDisplayedCount} unsupported=${report.unsupportedFileCount} warnings=${report.validationWarningCount} listDir=${report.listDirImageCount} recursive=${report.recursiveImageCount} logo=${report.contentLogoDirPresent} categories=${report.categoriesPresent} foodFolders=${report.foodFolderCount} foodSlides=${report.categoryFoodSlideCount} covers=${report.coverImageCount} text=${report.textSource ?? 'missing'} animation=${report.animationVideoMode} fonts=${report.fontFileCount}`,
  );
  const strong = report.issues.filter((i) => i.level === 'strong-warning');
  for (const issue of strong) {
    console.warn(`[content-validation] ${issue.code}: ${issue.message}`);
  }
  const rest = report.issues.filter((i) => i.level !== 'strong-warning');
  const preview = rest.slice(0, 8);
  for (const issue of preview) {
    console.warn(`[content-validation] ${issue.code}: ${issue.message}`);
  }
  if (rest.length > preview.length) {
    console.warn(`[content-validation] … ${rest.length - preview.length} more warning(s). Run npm run check:production-content`);
  }
}

export function getContentService(): ContentService {
  if (!cached) {
    throw new Error('ContentService not initialized');
  }
  return cached;
}

export function getExploreImages(): ExploreImageSet {
  const { contentRoot, assetIndex } = getContentService();
  return collectExploreImages(contentRoot, assetIndex.listImages);
}

/**
 * Renderer-loadable URL. Uses the privileged `trunk-content://` scheme so
 * Three TextureLoader / fetch can read content files from a sandboxed window.
 * Path is still validated against contentRoot.
 */
export function getContentFileUrl(relativePath: string): string {
  const { contentRoot } = getContentService();
  resolveContentPath(contentRoot, relativePath);
  return toContentRenderUrl(relativePath);
}

export function getCategoryGallery(categoryId: string): CategoryGallery {
  const { contentRoot, categories } = getContentService();
  const category = categories.find((row) => row.id === categoryId);
  if (!category) {
    throw new Error(`unknown categoryId: ${categoryId}`);
  }
  const gallery = buildCategoryGallery(contentRoot, category);
  for (const warning of gallery.warnings) {
    console.warn(`[content] gallery ${warning}`);
  }
  return gallery;
}

export function getSharedCopy(): SharedCopy {
  return getContentService().sharedCopy;
}

export function getContentImageValidation(): ContentImageValidationReport {
  return getContentService().imageValidation;
}
