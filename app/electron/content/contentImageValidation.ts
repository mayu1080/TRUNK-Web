import fs from 'node:fs';
import path from 'node:path';
import {
  CONTENT_LOGO_DIR,
  FILE_SIZE_WARNING_BYTES,
  FILENAME_MAX_CHARS,
  IMAGES_DIR,
  LIST_IMAGE_DIR,
  LONG_EDGE_STRONG_WARNING_PX,
  LONG_EDGE_WARNING_PX,
  TARGET_LIST_CARD_COUNT,
  expectedDisplayedCount,
  isDiscouragedImageExt,
  isLegacyImageExt,
  isRecommendedFileName,
  isRuntimeImageExt,
  isSupportedImageExt,
  normalizeExt,
} from '../../shared/contentImageRules';
import type {
  Category,
  ContentImageValidationReport,
  ContentValidationIssue,
  ContentValidationLevel,
} from '../../shared/types';
import { resolveContentPath } from './contentRoot';
import { collectExploreImages, scanImagesRecursive } from './exploreImageCollector';
import { scanListImages } from './assetIndexBuilder';
import { readImagePixelSize } from './imageDimensions';
import { buildCategoryGallery } from './categoryGallery';
import { loadSharedCopy } from './sharedCopy';
import { loadVideoPlaylist } from '../production/videoPlaylist';

export type { ContentImageValidationReport, ContentValidationIssue, ContentValidationLevel } from '../../shared/types';

function existsDir(abs: string): boolean {
  try {
    return fs.existsSync(abs) && fs.statSync(abs).isDirectory();
  } catch {
    return false;
  }
}

function existsFile(abs: string): boolean {
  try {
    return fs.existsSync(abs) && fs.statSync(abs).isFile();
  } catch {
    return false;
  }
}

function walkAllFiles(absDir: string, relDir: string, out: Array<{ relativePath: string; fileName: string }>): void {
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
      walkAllFiles(abs, rel, out);
      continue;
    }
    if (entry.isFile()) out.push({ relativePath: rel, fileName: entry.name });
  }
}

function pushIssue(
  issues: ContentValidationIssue[],
  level: ContentValidationLevel,
  code: string,
  message: string,
  relativePath?: string,
): void {
  issues.push({ level, code, message, relativePath });
}

const FONT_EXTS = new Set(['.otf', '.ttf', '.woff', '.woff2']);
const MAISON_REQUIRED = [
  'MaisonNeue-Book.otf',
  'MaisonNeue-Medium.otf',
  'MaisonNeue-Demi.otf',
  'MaisonNeue-Bold.otf',
];

function listFiles(absDir: string, allow: (name: string) => boolean): string[] {
  try {
    return fs.readdirSync(absDir).filter((name) => {
      if (name.startsWith('.')) return false;
      const full = path.join(absDir, name);
      return fs.existsSync(full) && fs.statSync(full).isFile() && allow(name);
    });
  } catch {
    return [];
  }
}

function listSubdirs(absDir: string): string[] {
  try {
    return fs.readdirSync(absDir).filter((name) => {
      if (name.startsWith('.')) return false;
      const full = path.join(absDir, name);
      return fs.existsSync(full) && fs.statSync(full).isDirectory();
    });
  } catch {
    return [];
  }
}

function countFilesRecursive(absDir: string, allow: (name: string) => boolean): number {
  let count = 0;
  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && allow(entry.name)) count += 1;
    }
  };
  walk(absDir);
  return count;
}

function loadCategoriesFromDisk(contentRoot: string): Category[] {
  const abs = path.join(contentRoot, 'categories.json');
  try {
    const parsed = JSON.parse(fs.readFileSync(abs, 'utf8')) as Category[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function validateProductionContentImages(
  contentRoot: string,
  categories?: Category[],
): ContentImageValidationReport {
  const issues: ContentValidationIssue[] = [];
  const contentRootExists = existsDir(contentRoot);
  const imagesAbs = contentRootExists ? resolveContentPath(contentRoot, IMAGES_DIR) : '';
  const listAbs = contentRootExists ? resolveContentPath(contentRoot, LIST_IMAGE_DIR) : '';
  const imagesDirExists = Boolean(imagesAbs && existsDir(imagesAbs));
  const listDirExists = Boolean(listAbs && existsDir(listAbs));
  const categoriesPresent = contentRootExists && existsFile(path.join(contentRoot, 'categories.json'));
  const contentLogoDirPresent = contentRootExists && existsDir(path.join(contentRoot, CONTENT_LOGO_DIR));

  if (!contentRootExists) {
    pushIssue(issues, 'strong-warning', 'content-root-missing', `contentRoot does not exist: ${contentRoot}`);
  }
  if (contentRootExists && !imagesDirExists) {
    pushIssue(issues, 'strong-warning', 'images-dir-missing', `missing ${IMAGES_DIR}/ under contentRoot`);
  }
  if (contentRootExists && !listDirExists) {
    pushIssue(issues, 'warning', 'list-dir-missing', `missing ${LIST_IMAGE_DIR}/ — recursive scan will be used if images exist`);
  }
  if (contentRootExists && !categoriesPresent) {
    pushIssue(issues, 'warning', 'categories-missing', 'categories.json is missing (Category modal needs it in Phase 4)');
  }
  if (contentRootExists && !contentLogoDirPresent) {
    pushIssue(issues, 'warning', 'logo-dir-missing', `missing content/${CONTENT_LOGO_DIR}/ (ZOOM / modal logo; LIST does not use it)`);
  }

  let listDirImageCount = 0;
  let recursiveImageCount = 0;
  let sourceImageCount = 0;
  let exploreSource: ContentImageValidationReport['exploreSource'] = 'none';
  let categoryIdAssignedCount = 0;
  let supportedCount = 0;
  let legacyCount = 0;
  let unsupportedFileCount = 0;
  let duplicateIdCount = 0;
  let filenameWarningCount = 0;
  let sizeWarningCount = 0;
  let strongSizeWarningCount = 0;
  let fileSizeWarningCount = 0;

  if (imagesDirExists) {
    const allFiles: Array<{ relativePath: string; fileName: string }> = [];
    walkAllFiles(imagesAbs, IMAGES_DIR, allFiles);

    const seenNames = new Map<string, string>();
    for (const file of allFiles) {
      const ext = normalizeExt(file.fileName);
      if (isSupportedImageExt(ext)) supportedCount += 1;
      else if (isLegacyImageExt(ext)) {
        legacyCount += 1;
        pushIssue(
          issues,
          'warning',
          'legacy-format',
          `${file.fileName}: ${ext} is loaded today but production intake should use png/jpg/jpeg/webp`,
          file.relativePath,
        );
      } else if (isDiscouragedImageExt(ext) || ext) {
        if (!isRuntimeImageExt(ext)) {
          unsupportedFileCount += 1;
          pushIssue(
            issues,
            'warning',
            'unsupported-format',
            `${file.fileName}: ${ext || '(no extension)'} is not used for PRODUCT_LIST`,
            file.relativePath,
          );
        }
      }

      if (!isRecommendedFileName(file.fileName)) {
        filenameWarningCount += 1;
        const reason =
          file.fileName.length > FILENAME_MAX_CHARS
            ? `longer than ${FILENAME_MAX_CHARS} chars`
            : 'use ASCII letters/digits, hyphen, underscore (Japanese is warning-only, not fatal)';
        pushIssue(issues, 'warning', 'filename-not-recommended', `${file.fileName}: ${reason}`, file.relativePath);
      }

      const lowerName = file.fileName.toLowerCase();
      const prev = seenNames.get(lowerName);
      if (prev && prev !== file.relativePath) {
        pushIssue(
          issues,
          'warning',
          'duplicate-basename',
          `same file name in two places: ${prev} and ${file.relativePath}`,
          file.relativePath,
        );
      } else {
        seenNames.set(lowerName, file.relativePath);
      }

      if (!isRuntimeImageExt(ext)) continue;

      try {
        const abs = resolveContentPath(contentRoot, file.relativePath);
        const bytes = fs.statSync(abs).size;
        if (bytes > FILE_SIZE_WARNING_BYTES) {
          fileSizeWarningCount += 1;
          pushIssue(
            issues,
            'warning',
            'file-too-large',
            `${file.fileName}: ${(bytes / (1024 * 1024)).toFixed(1)} MB > 8 MB`,
            file.relativePath,
          );
        }
        const pixels = readImagePixelSize(abs);
        if (pixels) {
          const longEdge = Math.max(pixels.width, pixels.height);
          if (longEdge > LONG_EDGE_STRONG_WARNING_PX) {
            strongSizeWarningCount += 1;
            pushIssue(
              issues,
              'strong-warning',
              'long-edge-very-large',
              `${file.fileName}: ${pixels.width}x${pixels.height} long edge ${longEdge}px > ${LONG_EDGE_STRONG_WARNING_PX}`,
              file.relativePath,
            );
          } else if (longEdge > LONG_EDGE_WARNING_PX) {
            sizeWarningCount += 1;
            pushIssue(
              issues,
              'warning',
              'long-edge-large',
              `${file.fileName}: ${pixels.width}x${pixels.height} long edge ${longEdge}px > ${LONG_EDGE_WARNING_PX}`,
              file.relativePath,
            );
          }
        }
      } catch (err) {
        pushIssue(
          issues,
          'warning',
          'stat-failed',
          `${file.fileName}: ${err instanceof Error ? err.message : String(err)}`,
          file.relativePath,
        );
      }
    }

    const listIndex = scanListImages(contentRoot, LIST_IMAGE_DIR);
    listDirImageCount = listIndex.length;
    recursiveImageCount = scanImagesRecursive(contentRoot).length;
    const runtime = collectExploreImages(contentRoot, listIndex);
    exploreSource = runtime.images.length > 0 ? runtime.source : 'none';
    sourceImageCount = runtime.images.length;
    categoryIdAssignedCount = runtime.images.filter((img) => Boolean(img.categoryId)).length;

    const ids = new Map<string, string>();
    for (const img of runtime.images) {
      const prev = ids.get(img.id);
      if (prev) {
        duplicateIdCount += 1;
        pushIssue(issues, 'warning', 'duplicate-id', `id ${img.id} used by ${prev} and ${img.relativePath}`, img.relativePath);
      } else {
        ids.set(img.id, img.relativePath);
      }
    }

    if (sourceImageCount === 0) {
      pushIssue(
        issues,
        'warning',
        'no-list-images',
        '0 usable LIST images — app will show fallback placeholder cards (not fatal)',
      );
    } else if (listDirImageCount === 0 && exploreSource === 'recursive-images') {
      pushIssue(
        issues,
        'warning',
        'using-recursive-scan',
        `${sourceImageCount} images from recursive ${IMAGES_DIR}/ scan because ${LIST_IMAGE_DIR}/ is empty. For production, put LIST files in ${LIST_IMAGE_DIR}/`,
      );
    }
  }

  const foodAbs = contentRootExists ? resolveContentPath(contentRoot, 'images/food') : '';
  const coverAbs = contentRootExists ? resolveContentPath(contentRoot, 'images/cover') : '';
  const textAbs = contentRootExists ? path.join(contentRoot, 'text') : '';
  const animationAbs = contentRootExists ? path.join(contentRoot, 'animation') : '';
  const adsAbs = contentRootExists ? path.join(contentRoot, 'ads') : '';
  const fontsAbs = contentRootExists ? path.join(contentRoot, 'fonts') : '';
  const foodDirExists = Boolean(foodAbs && existsDir(foodAbs));
  const coverDirExists = Boolean(coverAbs && existsDir(coverAbs));
  const textDirExists = Boolean(textAbs && existsDir(textAbs));
  const animationDirExists = Boolean(animationAbs && existsDir(animationAbs));
  const adsDirExists = Boolean(adsAbs && existsDir(adsAbs));
  const fontsDirExists = Boolean(fontsAbs && existsDir(fontsAbs));

  const loadedCategories = categories && categories.length > 0 ? categories : loadCategoriesFromDisk(contentRoot);
  const foodCategory = loadedCategories.find((row) => row.id === 'food');
  const jsonFolders = (foodCategory?.contentFolders ?? []).map((name) => name.trim()).filter(Boolean);
  const diskFoodFolders = foodDirExists ? listSubdirs(foodAbs) : [];
  const foodFolderNames = jsonFolders.length > 0 ? jsonFolders : [...diskFoodFolders].sort((a, b) => a.localeCompare(b, 'ja'));
  const foodFolderCount = foodFolderNames.length;

  if (contentRootExists && !foodDirExists) {
    pushIssue(issues, 'warning', 'food-dir-missing', 'missing images/food/ (Category modal Food)');
  }
  if (foodDirExists) {
    for (const folder of foodFolderNames) {
      const rel = `images/food/${folder}`;
      let abs: string;
      try {
        abs = resolveContentPath(contentRoot, rel);
      } catch {
        pushIssue(issues, 'warning', 'food-folder-missing', `Food content folder missing: ${rel}`, rel);
        continue;
      }
      if (!existsDir(abs)) {
        pushIssue(issues, 'warning', 'food-folder-missing', `Food content folder missing: ${rel}`, rel);
        continue;
      }
      const images = listFiles(abs, (name) => isRuntimeImageExt(normalizeExt(name)));
      if (images.length === 0) {
        pushIssue(issues, 'warning', 'food-folder-empty', `Food content folder has no raster images: ${rel}`, rel);
      }
    }
  }

  const coverImageCount = coverDirExists
    ? listFiles(coverAbs, (name) => isRuntimeImageExt(normalizeExt(name))).length
    : 0;
  if (contentRootExists && !coverDirExists) {
    pushIssue(issues, 'warning', 'cover-dir-missing', 'missing images/cover/ (Food category modal covers)');
  } else if (coverDirExists && coverImageCount === 0) {
    pushIssue(issues, 'warning', 'cover-images-missing', 'images/cover/ has no raster images');
  }

  const sharedCopy = contentRootExists
    ? loadSharedCopy(contentRoot)
    : { found: false, relativePath: 'text/TOKYO FOOD.txt', title: '', description: '', warning: 'contentRoot missing' };
  const textLoaded = sharedCopy.found;
  const textSource = sharedCopy.found ? sharedCopy.relativePath : null;
  if (contentRootExists && !textDirExists) {
    pushIssue(issues, 'warning', 'text-dir-missing', 'missing content/text/ — IMAGE_ZOOM / Category modal use fallback copy');
  } else if (!textLoaded) {
    pushIssue(
      issues,
      'warning',
      'text-missing',
      sharedCopy.warning ?? 'content/text/TOKYO FOOD.txt missing — IMAGE_ZOOM / Category modal use fallback copy',
      sharedCopy.relativePath,
    );
  }

  let animationVideoMode: ContentImageValidationReport['animationVideoMode'] = 'missing';
  let animationVideoFiles: string[] = [];
  let adsVideoMode: ContentImageValidationReport['adsVideoMode'] = 'missing';
  let adsVideoFiles: string[] = [];
  if (contentRootExists) {
    try {
      const playlist = loadVideoPlaylist(contentRoot, 'animation');
      animationVideoFiles = [...new Set(playlist.tracks.filter((track) => track.found).map((track) => track.relativePath))];
      if (animationVideoFiles.length === 0) animationVideoMode = 'missing';
      else if (animationVideoFiles.length === 1) animationVideoMode = 'single-shared';
      else animationVideoMode = 'per-monitor';
      for (const warning of playlist.warnings) {
        pushIssue(issues, 'warning', 'animation-playlist', warning);
      }
    } catch (err) {
      pushIssue(
        issues,
        'warning',
        'animation-playlist',
        err instanceof Error ? err.message : String(err),
      );
    }
    try {
      const playlist = loadVideoPlaylist(contentRoot, 'ads');
      adsVideoFiles = [...new Set(playlist.tracks.filter((track) => track.found).map((track) => track.relativePath))];
      if (adsVideoFiles.length === 0) adsVideoMode = 'missing';
      else if (adsVideoFiles.length === 1) adsVideoMode = 'single-shared';
      else adsVideoMode = 'per-monitor';
      for (const warning of playlist.warnings) {
        pushIssue(issues, 'warning', 'ads-playlist', warning);
      }
    } catch (err) {
      pushIssue(issues, 'warning', 'ads-playlist', err instanceof Error ? err.message : String(err));
    }
  }
  if (adsVideoMode === 'missing') {
    pushIssue(
      issues,
      'warning',
      'ads-missing',
      'no ads mp4 in content/ads/ — AD_IDLE shows placeholder; tap still starts ANIMATION',
    );
  }
  if (animationVideoMode === 'missing') {
    pushIssue(
      issues,
      'warning',
      'animation-missing',
      'no animation mp4 resolved — ANIMATION scene will use placeholder then PRODUCT_LIST',
    );
  }

  const fontFileCount = fontsDirExists
    ? countFilesRecursive(fontsAbs, (name) => FONT_EXTS.has(path.extname(name).toLowerCase()))
    : 0;
  if (fontsDirExists) {
    const maisonAbs = path.join(fontsAbs, 'MaisonNeue');
    if (!existsDir(maisonAbs)) {
      pushIssue(issues, 'warning', 'fonts-maison-missing', 'content/fonts/ exists but fonts/MaisonNeue is missing');
    } else {
      for (const name of MAISON_REQUIRED) {
        if (!existsFile(path.join(maisonAbs, name))) {
          pushIssue(issues, 'warning', 'fonts-face-missing', `missing ${name}`, `fonts/MaisonNeue/${name}`);
        }
      }
    }
  }

  let categoryFoodSlideCount = 0;
  if (foodCategory) {
    try {
      const gallery = buildCategoryGallery(contentRoot, foodCategory);
      categoryFoodSlideCount = gallery.images.length;
      for (const warning of gallery.warnings) {
        pushIssue(issues, 'warning', 'food-gallery', warning);
      }
    } catch (err) {
      pushIssue(
        issues,
        'warning',
        'food-gallery',
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  const report: ContentImageValidationReport = {
    contentRoot,
    contentRootExists,
    imagesDirExists,
    listDirExists,
    categoriesPresent,
    contentLogoDirPresent,
    exploreSource,
    listDirImageCount,
    recursiveImageCount,
    sourceImageCount,
    supportedCount,
    legacyCount,
    unsupportedFileCount,
    duplicateIdCount,
    filenameWarningCount,
    sizeWarningCount,
    strongSizeWarningCount,
    fileSizeWarningCount,
    categoryIdAssignedCount,
    expectedDisplayedCount: sourceImageCount > 0 ? expectedDisplayedCount(sourceImageCount) : TARGET_LIST_CARD_COUNT,
    targetCardCount: TARGET_LIST_CARD_COUNT,
    validationWarningCount: issues.length,
    issues,
    foodDirExists,
    foodFolderCount,
    foodFolderNames,
    categoryFoodSlideCount,
    coverDirExists,
    coverImageCount,
    textDirExists,
    textLoaded,
    textSource,
    animationDirExists,
    animationVideoMode,
    animationVideoFiles,
    adsDirExists,
    adsVideoMode,
    adsVideoFiles,
    fontsDirExists,
    fontFileCount,
  };
  return report;
}
