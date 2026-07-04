#!/usr/bin/env node
/**
 * content/images を再帰スキャンし、DBデモ用 demo-asset-index.json を生成する。
 * 実行: npm run generate:index
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SCAN_ROOT,
  IMAGE_EXTENSIONS,
  includeDirs,
  excludeDirs,
} from './scan-config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demoRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(demoRoot, '../../..');
const imagesRoot = path.join(repoRoot, SCAN_ROOT);
const outPath = path.join(demoRoot, 'public', 'demo-asset-index.json');

function isIncludedTopLevel(folder) {
  if (excludeDirs.includes(folder)) return false;
  if (includeDirs.length === 0) return true;
  return includeDirs.includes(folder);
}

function walkDir(dir, onFile) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, onFile);
    } else if (entry.isFile()) {
      onFile(full);
    }
  }
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function buildIndex() {
  const warnings = [];
  const images = [];
  const folderSet = new Set();

  if (!fs.existsSync(imagesRoot)) {
    warnings.push(`${SCAN_ROOT} が見つかりません: ${imagesRoot}`);
    return {
      mode: 'real-content-recursive',
      root: SCAN_ROOT,
      generatedAt: new Date().toISOString(),
      totalImages: 0,
      folders: [],
      includeDirs: [...includeDirs],
      excludeDirs: [...excludeDirs],
      images: [],
      warnings,
    };
  }

  walkDir(imagesRoot, (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) return;

    const relFromContent = toPosix(path.relative(path.join(repoRoot, 'content'), filePath));
    const relFromImages = toPosix(path.relative(imagesRoot, filePath));
    const segments = relFromImages.split('/');
    const topLevel = segments[0];
    if (!topLevel || !isIncludedTopLevel(topLevel)) return;

    folderSet.add(topLevel);
    const fileName = path.basename(filePath);
    const idPath = relFromImages.replace(/\.[^.]+$/, '');

    images.push({
      id: idPath,
      categoryId: topLevel,
      fileName,
      relativePath: relFromContent,
      url: `/content/${relFromContent}`,
      sourceFolder: topLevel,
    });
  });

  images.sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'en'));

  if (images.length === 0) {
    warnings.push(
      `${SCAN_ROOT} 配下（include: ${includeDirs.join(', ') || 'all'}）に画像が見つかりませんでした。`,
    );
  }

  return {
    mode: 'real-content-recursive',
    root: SCAN_ROOT,
    generatedAt: new Date().toISOString(),
    totalImages: images.length,
    folders: [...folderSet].sort(),
    includeDirs: [...includeDirs],
    excludeDirs: [...excludeDirs],
    images,
    warnings,
  };
}

const index = buildIndex();
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');

console.log(`[generate-demo-asset-index] wrote ${outPath}`);
console.log(`  totalImages: ${index.totalImages}`);
console.log(`  folders: ${index.folders.join(', ') || '(none)'}`);
if (index.warnings.length) {
  for (const w of index.warnings) console.warn(`  ⚠ ${w}`);
}
