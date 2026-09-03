import fs from 'node:fs';
import path from 'node:path';
import type { Category, CategoryGallery, CategoryGalleryImage } from '../../shared/types';
import { toContentRenderUrl } from './contentProtocol';
import { resolveContentPath } from './contentRoot';
import { collectCategoryImages } from './exploreImageCollector';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']);
const RASTER_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

function isImageFile(fileName: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

function listImagesInDir(contentRoot: string, relDir: string): Array<{ relativePath: string; fileName: string }> {
  const rel = relDir.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
  let abs: string;
  try {
    abs = resolveContentPath(contentRoot, rel);
  } catch {
    return [];
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) return [];

  let names: string[];
  try {
    names = fs.readdirSync(abs).filter((name) => {
      if (name.startsWith('.')) return false;
      const full = path.join(abs, name);
      return fs.existsSync(full) && fs.statSync(full).isFile() && isImageFile(name);
    });
  } catch {
    return [];
  }

  names.sort((a, b) => a.localeCompare(b, 'en'));
  const raster = names.filter((name) => RASTER_EXTENSIONS.has(path.extname(name).toLowerCase()));
  const selected = raster.length > 0 ? raster : names;
  return selected.map((fileName) => ({
    relativePath: `${rel}/${fileName}`,
    fileName,
  }));
}

function fileStem(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}

function introCoverRank(stem: string): number {
  const lower = stem.toLowerCase();
  if (lower === 'hyoshi' || stem === '表紙') return 0;
  if (lower === 'cover-front' || lower === 'intro') return 1;
  if (stem === '表紁E' || stem.startsWith('表')) return 2;
  return 3;
}

function folderLabel(category: Category, folder: string): string {
  const label = category.contentFolderLabels?.[folder];
  const trimmed = typeof label === 'string' ? label.trim() : '';
  return trimmed || folder;
}

/**
 * Opening 表紙: hyoshi.png / cover-front.png / intro.png / 表紙.png / 表紁E.png,
 * else the first cover whose stem is not a content folder name.
 */
function findIntroCover(
  covers: Array<{ relativePath: string; fileName: string }>,
  folderNames: string[],
): { relativePath: string; fileName: string } | null {
  const folders = new Set(folderNames);
  const candidates = covers.filter((file) => {
    const stem = fileStem(file.fileName);
    return introCoverRank(stem) < 3 || !folders.has(stem);
  });
  candidates.sort((a, b) => {
    const sa = fileStem(a.fileName);
    const sb = fileStem(b.fileName);
    const d = introCoverRank(sa) - introCoverRank(sb);
    return d !== 0 ? d : sa.localeCompare(sb, 'ja');
  });
  return candidates[0] ?? null;
}

function coverForFolder(
  covers: Array<{ relativePath: string; fileName: string }>,
  folder: string,
): { relativePath: string; fileName: string } | null {
  return covers.find((file) => fileStem(file.fileName) === folder) ?? null;
}

function toSlide(
  category: Category,
  id: string,
  file: { relativePath: string; fileName: string },
  kind: CategoryGalleryImage['kind'],
  contentFolder: string | null,
  courseName: string | null,
): CategoryGalleryImage {
  return {
    id,
    relativePath: file.relativePath,
    fileName: file.fileName,
    title: file.fileName,
    description: category.description ?? '',
    url: toContentRenderUrl(file.relativePath),
    kind,
    contentFolder,
    courseName,
  };
}

/**
 * Category modal slides.
 * If contentFolders is set, JSON order is the source of truth (disk folders not listed are skipped).
 * Food sets insertCoverBetweenFolders: opening 表紙 once, then coverDir/{folder}.png before each course.
 */
export function buildCategoryGallery(contentRoot: string, category: Category): CategoryGallery {
  const folders = (category.contentFolders ?? []).map((name) => name.trim()).filter(Boolean);
  const warnings: string[] = [];

  if (folders.length === 0) {
    const images = collectCategoryImages(contentRoot, category).map((img) => ({
      id: img.id,
      relativePath: img.relativePath,
      fileName: img.fileName,
      title: img.title || img.fileName,
      description: category.description ?? '',
      url: toContentRenderUrl(img.relativePath),
      kind: 'content' as const,
      contentFolder: null,
      courseName: null,
    }));
    return { category, images, warnings };
  }

  const insertCover = category.insertCoverBetweenFolders === true;
  const coverFiles = insertCover && category.coverDir ? listImagesInDir(contentRoot, category.coverDir) : [];
  if (insertCover && coverFiles.length === 0) {
    warnings.push(
      `${category.id}: insertCoverBetweenFolders is true but ${category.coverDir ?? '(no coverDir)'} has no image`,
    );
  }

  const images: CategoryGalleryImage[] = [];
  let coverSerial = 0;
  let contentSerial = 0;
  const showCourseName = insertCover;

  if (insertCover) {
    const intro = findIntroCover(coverFiles, folders);
    if (intro) {
      coverSerial += 1;
      images.push(
        toSlide(
          category,
          `${category.id}_cover_${String(coverSerial).padStart(2, '0')}`,
          intro,
          'cover',
          null,
          null,
        ),
      );
    } else {
      warnings.push(`${category.id}: no opening 表紙 image in ${category.coverDir ?? '(no coverDir)'}`);
    }
  }

  for (const folder of folders) {
    const rel = `${category.imageDir.replace(/\\/g, '/').replace(/\/+$/, '')}/${folder}`;
    const files = listImagesInDir(contentRoot, rel);
    const courseCover = insertCover ? coverForFolder(coverFiles, folder) : null;
    if (files.length === 0 && !courseCover) {
      warnings.push(`${category.id}: content folder missing or empty: ${rel}`);
      continue;
    }
    if (files.length === 0) {
      warnings.push(`${category.id}: content folder empty, showing course cover only: ${rel}`);
    }
    if (insertCover) {
      if (courseCover) {
        coverSerial += 1;
        images.push(
          toSlide(
            category,
            `${category.id}_cover_${String(coverSerial).padStart(2, '0')}`,
            courseCover,
            'cover',
            folder,
            showCourseName ? folderLabel(category, folder) : null,
          ),
        );
      } else {
        warnings.push(`${category.id}: no course cover for "${folder}" in ${category.coverDir ?? '(no coverDir)'}`);
      }
    }
    for (const file of files) {
      contentSerial += 1;
      images.push(
        toSlide(
          category,
          `${category.id}_${String(contentSerial).padStart(3, '0')}`,
          file,
          'content',
          folder,
          showCourseName ? folderLabel(category, folder) : null,
        ),
      );
    }
  }

  return { category, images, warnings };
}
