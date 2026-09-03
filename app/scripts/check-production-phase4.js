'use strict';

/**
 * Production Phase 4: overlay independence + category gallery wiring.
 * From app/ after `npm run build`: npm run check:production-phase4
 */
const fs = require('node:fs');
const path = require('node:path');
const {
  collectCategoryImages,
} = require('../dist/electron/content/exploreImageCollector');

function fail(message) {
  console.error(`[fail] ${message}`);
  process.exitCode = 1;
}

function resolveContentRoot() {
  if (process.env.TRUNK_CONTENT_ROOT && process.env.TRUNK_CONTENT_ROOT.trim()) {
    return path.resolve(process.env.TRUNK_CONTENT_ROOT.trim());
  }
  return path.resolve(__dirname, '..', '..', 'content');
}

require('./check-production-overlay.js');
if (process.exitCode) {
  console.error('production phase 4 overlay independence failed');
  process.exit(process.exitCode);
}

const contentRoot = resolveContentRoot();
const categoriesPath = path.join(contentRoot, 'categories.json');
if (!fs.existsSync(categoriesPath)) fail('categories.json missing');

const categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
if (!Array.isArray(categories) || categories.length === 0) fail('categories.json empty');

const gallery = {};
for (const category of categories) {
  const images = collectCategoryImages(contentRoot, category);
  gallery[category.id] = images.length;
  if (images.length === 0) {
    console.warn(`[warn] category ${category.id} has 0 gallery images (${category.imageDir})`);
  }
}

if (gallery.flower === 0) fail('flower gallery should have at least the sample image');
console.info('flower gallery count (1 is valid for Phase 5 single-slide layout):', gallery.flower);

const logoDir = path.join(contentRoot, 'Logo');
const logoPresent = fs.existsSync(logoDir) && fs.statSync(logoDir).isDirectory();
if (!logoPresent) fail('content/Logo missing');

console.info('production phase 4 category gallery check');
console.info(JSON.stringify({ contentRoot, gallery, logoPresent, categoryCount: categories.length }, null, 2));

if (process.exitCode) {
  console.error('production phase 4 check failed');
  process.exit(process.exitCode);
}
console.info('production phase 4 check ok');
