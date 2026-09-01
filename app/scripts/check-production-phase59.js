'use strict';

/**
 * Production Phase 5.9: near fade, list speed, IMAGE_ZOOM logo/motion, preview AD_IDLE docs.
 * From app/ after `npm run build`: npm run check:production-phase59
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
  console.error('production phase 5.9 overlay independence failed');
  process.exit(process.exitCode);
}

const src = path.join(__dirname, '..', 'renderer', 'production', 'src');

mustContain(path.join(src, 'listConfig.ts'), ['listMotionSpeed: 2.6', 'bubbleSizePx: 160', 'revealRadiusPx: 80']);
mustContain(path.join(src, 'three', 'sceneLayout.ts'), [
  'nearFadeStartDist: 1520',
  'nearFadeEndDist: 840',
  'nearScaleEnabled: false',
  'maxScaleClamp: 1',
  'maxApparentScaleDist: 1520',
]);
mustContain(path.join(src, 'imageZoomMotion.ts'), [
  'DRAWER_MOTION.durationMs',
  'DRAWER_MOTION.closeMs',
  'DRAWER_SCRIM_MOTION.durationMs',
  'DRAWER_MOTION.easingCss',
  'DRAWER_MOTION.initial.x',
  'DRAWER_MOTION.exit.x',
]);
mustContain(path.join(src, 'overlays', 'ImageZoomOverlay.tsx'), [
  'IMAGE_ZOOM_MOTION',
  'image-zoom-overlay__chrome',
  'openClass',
  'is-closing',
  'requestAnimationFrame',
]);
mustContain(path.join(src, 'App.tsx'), ['open={zoomOpen}', 'startupScene', 'IMAGE_ZOOM_MOTION']);
mustContain(path.join(src, 'styles.css'), [
  'clamp(160px, 20vh, 300px)',
  'translateY(12px)',
  'translateY(7.2px)',
  'image-zoom-overlay__chrome',
  'image-zoom-overlay.is-open',
]);
mustContain(path.join(src, 'ui', 'CategoryDrawer.tsx'), ['DRAWER_MOTION', 'formatDrawerLabel', 'Explore']);
mustContain(path.join(__dirname, '..', 'electron', 'main.ts'), [
  "previewWindows === 'single'",
  "scene: 'PRODUCT_LIST'",
  "lastProductionScene = 'AD_IDLE'",
  'Keys 1 / 2 / 3',
]);
mustContain(path.join(__dirname, '..', 'README.md'), [
  '初期シーンは PRODUCT_LIST',
  'AD_IDLE',
  'start:production:preview:multi',
]);
mustContain(path.join(__dirname, '..', 'shared', 'idleConfig.ts'), ['PRODUCTION_SHELL_IDLE_TIMEOUT_SECONDS = 120']);
mustContain(path.join(__dirname, '..', 'shared', 'productionState.ts'), [
  "interactionLocked: state.localOverlay !== 'NONE'",
]);

if (process.exitCode) {
  console.error('production phase 5.9 check failed');
  process.exit(process.exitCode);
}
console.info('production phase 5.9 check ok');
