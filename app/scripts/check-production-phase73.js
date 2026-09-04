'use strict';

/**
 * Production Phase 7.3: two-finger = dolly cruise only; 1-finger pan stays.
 * From app/ after `npm run build`: npm run check:production-phase73
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

const src = path.join(__dirname, '..', 'renderer', 'production', 'src');
const controller = path.join(src, 'three', 'exploreController.ts');

mustContain(path.join(src, 'listConfig.ts'), [
  'twoFingerVerticalDeadZonePx',
  'twoFingerDollyScale: 2.5',
  'twoFingerDollyMaxDeltaPx',
  'twoFingerPinchDeadZonePx',
]);
mustContain(controller, [
  "'two-finger-vertical'",
  'twoFingerDollyActive',
  'twoFingerMode',
  'vertical-dolly',
  'pinch-dolly',
  'this.pointers.size === 1 && !this.pinchSession',
  'listConfig.twoFingerDollyScale',
  "source === 'two-finger-vertical'",
]);
mustContain(path.join(src, 'types.ts'), [
  'twoFingerDollyActive',
  'twoFingerDollyDeltaY',
  'twoFingerDollyTotalY',
  'twoFingerDollyDeadZonePx',
  'twoFingerDollyScale',
]);
mustContain(path.join(src, 'App.tsx'), [
  'twoFingerDollyActive',
  'twoFingerDollyDeadZonePx',
  'twoFingerDollyScale',
  'tapSuppressedByPinch',
]);

const controllerText = fs.readFileSync(controller, 'utf8');
if (!controllerText.includes("applyDollyImpulse(pinchDelta, 'pinch')") && !controllerText.includes("applyDollyImpulse(dist - this.pinchOriginDistance, 'pinch')")) {
  fail('pinch-to-dolly must remain (two-finger pinch still applies dolly)');
}
if (controllerText.includes('pinchMag > vertMag')) {
  fail('two-finger vertical must not lose to per-frame pinchMag > vertMag');
}

if (process.exitCode) {
  console.error('production phase 7.3 check failed');
  process.exit(process.exitCode);
}
console.info('production phase 7.3 check ok');
