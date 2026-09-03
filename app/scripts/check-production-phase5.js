'use strict';

/**
 * Production Phase 5: UX FB markers + overlay independence still holds.
 * From app/ after `npm run build`: npm run check:production-phase5
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

function mustContain(filePath, needles) {
  const text = fs.readFileSync(filePath, 'utf8');
  for (const needle of needles) {
    if (!text.includes(needle)) fail(`${path.relative(path.join(__dirname, '..'), filePath)} missing ${JSON.stringify(needle)}`);
  }
}

require('./check-production-overlay.js');
if (process.exitCode) {
  console.error('production phase 5 overlay independence failed');
  process.exit(process.exitCode);
}

const src = path.join(__dirname, '..', 'renderer', 'production', 'src');
mustContain(path.join(src, 'overlays', 'ImageZoomOverlay.tsx'), [
  'image-zoom-overlay__card',
  'image-zoom-overlay__close-corner',
  'image-zoom-overlay__logo',
  'onClick={onClose}',
]);
mustContain(path.join(src, 'overlays', 'CategoryModal.tsx'), [
  'is-single',
  'FLICK_PX_PER_MS',
  'SLIDE_PCT',
]);
mustContain(path.join(src, 'three', 'sceneLayout.ts'), [
  'nearFadeStartDist: 1520',
  'nearFadeEndDist: 840',
  'appearFadeMs: 700',
]);
mustContain(path.join(src, 'three', 'exploreController.ts'), [
  "'two-finger-vertical'",
  'appearT',
  'twoFingerVerticalArmed',
]);
mustContain(path.join(src, 'ui', 'NoiseOverlay.tsx'), ['listConfig.noiseEnabled']);
mustContain(path.join(src, 'ui', 'BoxLogo.tsx'), ['stopPropagation']);
mustContain(path.join(src, 'listConfig.ts'), ['noiseEnabled: true', 'twoFingerVerticalDeadZonePx']);

mustContain(
  path.join(__dirname, '..', 'shared', 'productionState.ts'),
  ["interactionLocked: state.localOverlay !== 'NONE'"],
);
mustContain(path.join(__dirname, '..', 'electron', 'production', 'productionStateCoordinator.ts'), [
  'localOverlay',
  'OPEN_IMAGE_ZOOM',
]);

const idle = fs.readFileSync(path.join(__dirname, '..', 'shared', 'idleConfig.ts'), 'utf8');
if (!idle.includes('PRODUCTION_SHELL_IDLE_TIMEOUT_SECONDS = 120')) {
  fail('120s production shell idle constant changed');
}

const contentRoot = resolveContentRoot();
const categories = JSON.parse(fs.readFileSync(path.join(contentRoot, 'categories.json'), 'utf8'));
const flower = categories.find((row) => row.id === 'flower');
if (!flower) fail('flower category missing');
const flowerCount = collectCategoryImages(contentRoot, flower).length;
if (flowerCount < 1) fail('flower gallery must have at least 1 image for single-slide modal');
console.info('flower gallery count (1 is valid for Phase 5 single-slide layout):', flowerCount);

if (process.exitCode) {
  console.error('production phase 5 check failed');
  process.exit(process.exitCode);
}
console.info('production phase 5 check ok');
