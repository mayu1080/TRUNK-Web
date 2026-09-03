'use strict';

/**
 * Production Phase 5.7: chrome / preload / near fade / preview defaults / noise / IMAGE_ZOOM card / Drawer.
 * From app/ after `npm run build`: npm run check:production-phase57
 */
const fs = require('node:fs');
const path = require('node:path');

function fail(message) {
  console.error(`[fail] ${message}`);
  process.exitCode = 1;
}

function mustContain(filePath, needles) {
  const text = fs.readFileSync(filePath, 'utf8');
  for (const needle of needles) {
    if (!text.includes(needle)) {
      fail(`${path.relative(path.join(__dirname, '..'), filePath)} missing ${JSON.stringify(needle)}`);
    }
  }
}

function mustNotContainTree(dir, needle) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      mustNotContainTree(full, needle);
      continue;
    }
    if (!/\.(tsx?|css)$/.test(entry.name)) continue;
    const text = fs.readFileSync(full, 'utf8');
    if (text.includes(needle)) {
      fail(`${path.relative(path.join(__dirname, '..'), full)} should not contain ${JSON.stringify(needle)}`);
    }
  }
}

require('./check-production-overlay.js');
if (process.exitCode) {
  console.error('production phase 5.7 overlay independence failed');
  process.exit(process.exitCode);
}

const src = path.join(__dirname, '..', 'renderer', 'production', 'src');
mustNotContainTree(src, 'loading content images');

mustContain(path.join(src, 'uiMode.ts'), ["'review'", "'debug'"]);
mustContain(path.join(src, 'App.tsx'), [
  'review-mode',
  'chromeVisible',
  'preloadReadyBeforeListEnter',
  'listVisualReady',
  "key === 'd' || key === 'g'",
]);
mustContain(path.join(src, 'listConfig.ts'), [
  'bubbleSizePx: 160',
  'listMotionSpeed: 2.6',
]);
mustContain(path.join(src, 'runtimeConfig.ts'), [
  "bubbleMotionId: 'off'",
  'DOLLY_FEEL_PRESETS',
  'punchy',
]);
mustContain(path.join(src, 'three', 'exploreController.ts'), ['maxApparentScaleDist', 'card.mesh.scale.set']);
mustContain(path.join(src, 'overlays', 'ImageZoomOverlay.tsx'), [
  'image-zoom-overlay__card',
  'image-zoom-overlay__logo',
  'image-zoom-overlay__close-corner',
]);
mustContain(path.join(src, 'imageCopy.ts'), ['image-details.json', 'SAMPLE_IMAGE_DESCRIPTION', 'formatDrawerLabel']);
mustContain(path.join(src, 'ui', 'CategoryDrawer.tsx'), ['formatDrawerLabel', 'Explore', 'Category']);
mustContain(path.join(src, 'styles.css'), [
  'review-mode .topbar',
  '-webkit-tap-highlight-color: transparent',
  '.drawer-scrim:active',
  '.image-zoom-overlay__card',
  'text-transform: none',
]);
mustContain(path.join(src, 'ui', 'BubbleOverlay.tsx'), ['bubble-overlay--off']);
mustContain(path.join(__dirname, '..', 'electron', 'content', 'logoAsset.ts'), ['logo_text']);
mustContain(path.join(__dirname, '..', 'electron', 'main.ts'), ['frame: false']);
mustContain(path.join(__dirname, '..', 'shared', 'idleConfig.ts'), ['PRODUCTION_SHELL_IDLE_TIMEOUT_SECONDS = 120']);
mustContain(path.join(__dirname, '..', 'shared', 'productionState.ts'), [
  "interactionLocked: state.localOverlay !== 'NONE'",
]);
mustContain(path.join(__dirname, '..', '..', 'docs', 'production', 'production-image-copy.md'), [
  'image-details.json',
  '案A',
]);

const categories = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'content', 'categories.json'), 'utf8'),
);
for (const id of ['food', 'gift', 'flower']) {
  const row = categories.find((item) => item.id === id);
  if (!row) fail(`category ${id} missing`);
  if (row.label !== id.charAt(0).toUpperCase() + id.slice(1)) {
    fail(`category ${id} label should be title case, got ${JSON.stringify(row.label)}`);
  }
}

const drawer = fs.readFileSync(path.join(src, 'ui', 'CategoryDrawer.tsx'), 'utf8');
if (drawer.includes('FOOD') || drawer.includes('GIFT') || drawer.includes('FLOWER')) {
  fail('CategoryDrawer should not hardcode uppercase FOOD/GIFT/FLOWER');
}

if (process.exitCode) {
  console.error('production phase 5.7 check failed');
  process.exit(process.exitCode);
}
console.info('production phase 5.7 check ok');
