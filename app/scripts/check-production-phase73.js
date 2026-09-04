'use strict';

/**
 * Production Phase 7.3: gesture arbitration / two-finger dolly / multi-touch block / admin touch consume.
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

function mustNotContain(filePath, needles) {
  const text = fs.readFileSync(filePath, 'utf8');
  for (const needle of needles) {
    if (text.includes(needle)) {
      fail(`${path.relative(path.join(__dirname, '..'), filePath)} should not contain ${JSON.stringify(needle)}`);
    }
  }
}

const app = path.join(__dirname, '..');
const src = path.join(app, 'renderer', 'production', 'src');
const controller = path.join(src, 'three', 'exploreController.ts');
const sceneLayout = path.join(src, 'three', 'sceneLayout.ts');

mustContain(path.join(src, 'listConfig.ts'), [
  'twoFingerVerticalDeadZonePx',
  'twoFingerDollyScale: 2.5',
  'twoFingerDollyMaxDeltaPx: 280',
  'twoFingerPinchDeadZonePx',
  'pinchDollyScale: 2.4',
]);
mustContain(controller, [
  "'two-finger-vertical'",
  'twoFingerDollyActive',
  'gestureMode',
  'two-finger-pending',
  'two-finger-swipe-dolly',
  'two-finger-pinch-dolly',
  'multi-touch-blocked',
  'enterMultiTouchBlocked',
  'beginTwoFingerSessionIfNeeded',
  'lostpointercapture',
  'listConfig.twoFingerDollyScale',
  "source === 'two-finger-vertical'",
  'sessionBlocksOneFinger',
  "this.gestureMode === 'one-finger'",
  'pinchCentroidYBetween',
  'applyDollyImpulse(pinchDelta, \'pinch\')',
  'applyDollyImpulse(dist - this.pinchOriginDistance, \'pinch\')',
]);
mustContain(path.join(src, 'types.ts'), [
  'twoFingerDollyActive',
  'ListGestureMode',
  'multiTouchBlocked',
  'tapSuppressedByMultiTouch',
  'twoFingerDollyMaxDeltaPx',
  "'two-finger-swipe-dolly'",
  "'multi-touch-blocked'",
]);
mustContain(path.join(src, 'App.tsx'), [
  'twoFingerDollyActive',
  'gestureMode',
  'multiTouchBlocked',
  'tapSuppressedByPinch',
  'tapSuppressedByTwoFinger',
  'tapSuppressedByMultiTouch',
  'twoFingerDollyMaxDeltaPx',
  'displayId',
  'windowId',
  'lastDollyInput',
  'dollyVelocity',
  'targetCameraZ',
]);
mustContain(path.join(src, 'styles.css'), [
  'touch-action: none',
  'touch-action: pan-y',
]);
mustContain(path.join(src, 'three', 'ExploreHost.tsx'), [
  'new ExploreController(',
]);
mustContain(path.join(app, 'electron', 'production', 'managementConsole.html'), [
  "pointerType === 'touch'",
  'stopImmediatePropagation',
  'adminTouchBlocked',
  'consumeAdminTouch',
  'touchcancel',
]);
mustContain(sceneLayout, [
  'impulsePer100px: 520',
  'maxSpeed: 1600',
]);
mustNotContain(path.join(app, 'electron', 'main.ts'), ['setIgnoreMouseEvents']);
mustNotContain(path.join(app, 'electron', 'production', 'managementConsole.html'), ['setIgnoreMouseEvents']);
mustNotContain(controller, ['twoFingerMode', 'beginPinchIfNeeded']);

const controllerText = fs.readFileSync(controller, 'utf8');
if (controllerText.includes('pinchMag > vertMag')) {
  fail('two-finger vertical must not lose to per-frame pinchMag > vertMag');
}
if (!/private pointers = new Map/.test(controllerText)) {
  fail('gesture pointers must stay instance state (per ExploreController / window)');
}
if (/^(?:const|let|var) pointers\s*=\s*new Map/m.test(controllerText)) {
  fail('gesture pointers must not be a module-level global Map');
}

if (process.exitCode) {
  console.error('production phase 7.3 check failed');
  process.exit(process.exitCode);
}
console.info('production phase 7.3 check ok');
