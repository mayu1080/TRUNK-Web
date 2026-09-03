'use strict';

/**
 * Production Phase 5.8: LIST fade/density/clean/bubble/noise, IMAGE_ZOOM card, drawer motion, preview frameless.
 * From app/ after `npm run build`: npm run check:production-phase58
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

require('./check-production-overlay.js');
if (process.exitCode) {
  console.error('production phase 5.8 overlay independence failed');
  process.exit(process.exitCode);
}

const src = path.join(__dirname, '..', 'renderer', 'production', 'src');

mustContain(path.join(src, 'listConfig.ts'), [
  'bubbleSizePx: 160',
  'revealRadiusPx: 80',
  'noiseOpacity: 0.48',
  'targetCardCount: 96',
  "densityPreset: 'dense-96'",
]);
mustContain(path.join(src, 'runtimeConfig.ts'), ["visualPresetId: 'clean'", "bubbleMotionId: 'off'"]);
mustContain(path.join(src, 'three', 'sceneLayout.ts'), [
  'nearFadeStartDist: 1520',
  'nearFadeEndDist: 840',
  'nearScaleStartDist: 1360',
  'nearScaleMin: 0.2',
  'xRange: [-1860, 1860]',
]);
mustContain(path.join(src, 'drawerMotion.ts'), [
  'durationMs: 260',
  'closeMs: 230',
  'cubic-bezier(0.32, 0, 0.58, 0.02)',
  'x: 7.2',
]);
mustContain(path.join(src, 'ui', 'CategoryDrawer.tsx'), ['DRAWER_MOTION', 'requestAnimationFrame', 'is-open']);
mustContain(path.join(src, 'styles.css'), [
  'cubic-bezier(0.32, 0, 0.58, 0.02)',
  'translateX(12px)',
  'font-weight: 300',
  'clamp(160px, 20vh, 300px)',
  'min-height: 8.2em',
]);
mustContain(path.join(src, 'overlays', 'ImageZoomOverlay.tsx'), ['image-zoom-overlay__close-glyph']);
mustContain(path.join(src, 'App.tsx'), ['densityPreset', 'sceneSpreadX']);
mustContain(path.join(__dirname, '..', 'electron', 'production', 'previewConfig.ts'), [
  'TRUNK_PRODUCTION_PREVIEW_FRAME',
]);
mustContain(path.join(__dirname, '..', 'electron', 'production', 'windowPlacement.ts'), ['previewFrame']);
mustContain(path.join(__dirname, '..', 'electron', 'main.ts'), ['previewFrame', 'frame: false']);
mustContain(path.join(__dirname, '..', 'README.md'), [
  'TRUNK_PRODUCTION_PREVIEW_FRAME',
  'frameless',
]);
mustContain(path.join(__dirname, '..', 'shared', 'contentImageRules.ts'), ['TARGET_LIST_CARD_COUNT = 96']);
mustContain(path.join(__dirname, '..', 'shared', 'idleConfig.ts'), ['PRODUCTION_SHELL_IDLE_TIMEOUT_SECONDS = 120']);
mustContain(path.join(__dirname, '..', 'shared', 'productionState.ts'), [
  "interactionLocked: state.localOverlay !== 'NONE'",
]);

if (process.exitCode) {
  console.error('production phase 5.8 check failed');
  process.exit(process.exitCode);
}
console.info('production phase 5.8 check ok');
