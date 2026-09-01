'use strict';

/**
 * Production Phase 5.11: earlier near fade, slightly longer IMAGE_ZOOM close.
 * From app/ after `npm run build`: npm run check:production-phase511
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
  console.error('production phase 5.11 overlay independence failed');
  process.exit(process.exitCode);
}

const src = path.join(__dirname, '..', 'renderer', 'production', 'src');

mustContain(path.join(src, 'listConfig.ts'), ['listMotionSpeed: 2.6']);
mustContain(path.join(src, 'three', 'sceneLayout.ts'), [
  'nearFadeStartDist: 1520',
  'nearFadeEndDist: 840',
  'maxApparentScaleDist: 1520',
  'sceneDriftSpeed: 72',
  'nearScaleEnabled: false',
]);
mustContain(path.join(src, 'three', 'exploreController.ts'), [
  'dist <= cam.nearFadeEndDist',
  'sceneDriftSpeed',
]);
mustContain(path.join(src, 'imageZoomMotion.ts'), [
  'DRAWER_MOTION.durationMs',
  'DRAWER_MOTION.closeMs',
  'DRAWER_SCRIM_MOTION.durationMs',
  'DRAWER_MOTION.easingCss',
]);
mustContain(path.join(src, 'styles.css'), [
  'opacity 220ms cubic-bezier(0.32, 0, 0.58, 0.02)',
  'transition-duration: 260ms',
  'translateY(7.2px)',
  'image-zoom-overlay__chrome',
  'transform 230ms cubic-bezier(0.32, 0, 0.58, 0.02)',
]);
mustContain(path.join(src, 'drawerMotion.ts'), ['durationMs: 260', 'closeMs: 230']);
mustContain(path.join(__dirname, '..', 'shared', 'idleConfig.ts'), ['PRODUCTION_SHELL_IDLE_TIMEOUT_SECONDS = 120']);
mustContain(path.join(__dirname, '..', 'shared', 'productionState.ts'), [
  "interactionLocked: state.localOverlay !== 'NONE'",
]);

if (process.exitCode) {
  console.error('production phase 5.11 check failed');
  process.exit(process.exitCode);
}
console.info('production phase 5.11 check ok');
