import fs from 'node:fs';
import path from 'node:path';
import type { Category, ExploreImageEntry, ExploreImageSet, ListImageEntry } from '../../shared/types';
import { resolveContentPath } from './contentRoot';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']);
const RASTER_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const IMAGES_DIR = 'images';

function isImageFile(fileName: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

function fileStem(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}

function enrichFromPath(entry: ListImageEntry): ExploreImageEntry {
  const parts = entry.relativePath.replace(/\\/g, '/').split('/').filter(Boolean);
  const categoryId = parts[0] === IMAGES_DIR && parts[1] ? parts[1] : undefined;
  const parent = parts.length >= 2 ? parts[parts.length - 2] : undefined;
  const title = parent && parent !== IMAGES_DIR ? parent : fileStem(entry.fileName);
  return {
    ...entry,
    categoryId,
    title,
  };
}

function walkImages(absDir: string, relDir: string, out: ExploreImageEntry[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const abs = path.join(absDir, entry.name);
    const rel = `${relDir}/${entry.name}`.replace(/\\/g, '/');
    if (entry.isDirectory()) {
      walkImages(abs, rel, out);
      continue;
    }
    if (!entry.isFile() || !isImageFile(entry.name)) continue;
    out.push(
      enrichFromPath({
        id: '',
        relativePath: rel,
        fileName: entry.name,
      }),
    );
  }
}

export function scanImagesRecursive(contentRoot: string): ExploreImageEntry[] {
  const abs = resolveContentPath(contentRoot, IMAGES_DIR);
  const found: ExploreImageEntry[] = [];
  walkImages(abs, IMAGES_DIR, found);
  found.sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'en'));

  const raster = found.filter((img) =>
    RASTER_EXTENSIONS.has(path.extname(img.fileName).toLowerCase()),
  );
  const selected = raster.length > 0 ? raster : found;

  return selected.map((img, index) => ({
    ...img,
    id: img.id || `src_${String(index + 1).padStart(3, '0')}`,
  }));
}

/**
 * 1. assetIndex.listImages (scan of content/images/list)
 * 2. if that folder is empty, recurse content/images
 * (food/gift/flower/list/cm, etc.) so LIST can still populate.
 */
export function collectExploreImages(
  contentRoot: string,
  listImages: ListImageEntry[],
): ExploreImageSet {
  if (listImages.length > 0) {
    return {
      source: 'listImages',
      images: listImages.map(enrichFromPath),
    };
  }

  return {
    source: 'recursive-images',
    images: scanImagesRecursive(contentRoot),
  };
}

/** Category modal: scan that category's imageDir. Independent from LIST listImages. */
export function collectCategoryImages(contentRoot: string, category: Category): ExploreImageEntry[] {
  const rel = category.imageDir.replace(/\\/g, '/').replace(/^\/+/, '');
  let abs: string;
  try {
    abs = resolveContentPath(contentRoot, rel);
  } catch {
    return [];
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) return [];

  const found: ExploreImageEntry[] = [];
  walkImages(abs, rel, found);
  found.sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'en'));

  const raster = found.filter((img) =>
    RASTER_EXTENSIONS.has(path.extname(img.fileName).toLowerCase()),
  );
  const selected = raster.length > 0 ? raster : found;

  return selected.map((img, index) => ({
    ...img,
    id: img.id || `${category.id}_${String(index + 1).padStart(3, '0')}`,
    categoryId: category.id,
  }));
}
