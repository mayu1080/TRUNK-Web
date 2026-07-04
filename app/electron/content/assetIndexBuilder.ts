import fs from 'node:fs';
import path from 'node:path';
import type { AssetIndex, ListImageEntry } from '../../shared/types';
import type { LoadedContent } from './loaders';
import { resolveContentPath } from './contentRoot';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']);

function isImageFile(fileName: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

function scanListImages(contentRoot: string, listDirRelative: string): ListImageEntry[] {
  const listDir = resolveContentPath(contentRoot, listDirRelative);
  const files = fs
    .readdirSync(listDir)
    .filter((f) => !f.startsWith('.') && isImageFile(f))
    .sort();

  return files.map((fileName, index) => {
    const relativePath = path.join(listDirRelative, fileName).split(path.sep).join('/');
    return {
      id: `list_${String(index + 1).padStart(3, '0')}`,
      relativePath,
      fileName,
    };
  });
}

export function buildAssetIndex(
  contentRoot: string,
  loaded: LoadedContent,
  warnings: string[],
): AssetIndex {
  const listImages = scanListImages(contentRoot, loaded.manifest.defaultListImageDir);

  return {
    version: loaded.manifest.version,
    updatedAt: loaded.manifest.updatedAt,
    contentRoot,
    listImages,
    categories: [...loaded.categories].sort((a, b) => a.order - b.order),
    products: loaded.products,
    warnings: [...warnings],
  };
}
