/**
 * DBデモ用: content/images スキャン設定
 * cm を外す場合は excludeDirs に追加するだけで可
 */
export const SCAN_ROOT = 'content/images';

/** 空配列 = images 直下の全トップレベルフォルダを対象 */
export const includeDirs = ['cm', 'flower', 'food', 'gift', 'list'];

export const excludeDirs = [];

export const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
]);
