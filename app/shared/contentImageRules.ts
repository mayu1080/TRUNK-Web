/** Shared LIST image intake rules. Runtime still accepts gif/svg; those get validation warnings. */

export const TARGET_LIST_CARD_COUNT = 96;

export const SUPPORTED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'] as const;

/** Loaded today for compatibility, but not recommended for production intake. */
export const LEGACY_IMAGE_EXTENSIONS = ['.gif', '.svg'] as const;

export const DISCOURAGED_IMAGE_EXTENSIONS = ['.heic', '.heif', '.tif', '.tiff', '.psd', '.ai', '.pdf', '.bmp'] as const;

export const LONG_EDGE_WARNING_PX = 2500;
export const LONG_EDGE_STRONG_WARNING_PX = 4000;
export const FILE_SIZE_WARNING_BYTES = 8 * 1024 * 1024;
export const FILENAME_MAX_CHARS = 80;

export const LIST_IMAGE_DIR = 'images/list';
export const IMAGES_DIR = 'images';
export const CONTENT_LOGO_DIR = 'Logo';

export function normalizeExt(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  if (idx < 0) return '';
  return fileName.slice(idx).toLowerCase();
}

export function isSupportedImageExt(ext: string): boolean {
  return (SUPPORTED_IMAGE_EXTENSIONS as readonly string[]).includes(ext);
}

export function isLegacyImageExt(ext: string): boolean {
  return (LEGACY_IMAGE_EXTENSIONS as readonly string[]).includes(ext);
}

export function isDiscouragedImageExt(ext: string): boolean {
  return (DISCOURAGED_IMAGE_EXTENSIONS as readonly string[]).includes(ext);
}

export function isRuntimeImageExt(ext: string): boolean {
  return isSupportedImageExt(ext) || isLegacyImageExt(ext);
}

/** ASCII letter/digit, hyphen, underscore, dot. Leading alnum required. */
export function isRecommendedFileName(fileName: string): boolean {
  if (!fileName || fileName.length > FILENAME_MAX_CHARS) return false;
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(fileName);
}

export function expectedDisplayedCount(sourceImageCount: number): number {
  if (sourceImageCount <= 0) return TARGET_LIST_CARD_COUNT;
  return TARGET_LIST_CARD_COUNT;
}
