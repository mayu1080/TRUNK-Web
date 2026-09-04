'use strict';

/**
 * Production Phase 7.4: 3-finger OS block / 2-finger no XY pan / per-monitor bubble.
 * From app/ after `npm run build`: npm run check:production-phase74
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
const host = path.join(src, 'three', 'ExploreHost.tsx');
const overlay = path.join(src, 'ui', 'BubbleOverlay.tsx');
const mainTs = path.join(app, 'electron', 'main.ts');

mustContain(controller, [
  'nativeTouchCount',
  'effectiveFingerCount',
  'e.touches.length',
  'sessionBlocksOneFinger',
  'enterMultiTouchBlocked',
  'hideBubbleForMultiTouch',
  'twoFingerPanActive: false',
  'bubbleMonitorId',
  'lastPointerType',
  'lastTouchMonitorId',
  'this.nativeTouchCount <= 1',
  "this.gestureMode === 'one-finger'",
  "source === 'two-finger-vertical'",
  "applyDollyImpulse(pinchDelta, 'pinch')",
  '{ passive: false, capture: true }',
]);
mustContain(path.join(src, 'types.ts'), [
  'twoFingerPanActive',
  'nativeTouchCount',
  'bubbleMonitorId',
  'bubbleX',
  'lastTouchMonitorId',
  'lastPointerType',
]);
mustContain(path.join(src, 'App.tsx'), [
  'twoFingerPanActive',
  'nativeTouchCount',
  'activeBubbleCount',
  'bubbleMonitorId',
  'lastPointerType',
  'lastTouchMonitorId',
  'reportBubbleState',
  'onBubbleAggregate',
  'displayId',
  'windowId',
  'event.touches.length >= 3',
  '{ capture: true, passive: false }',
]);
mustContain(path.join(src, 'styles.css'), ['touch-action: none', 'touch-action: pan-y']);
mustContain(host, ['new ExploreController(', 'BubbleOverlay', 'layout.monitorId']);
mustContain(overlay, ['data-bubble-monitor-id', 'offsetParent', 'state.screenX - origin.left']);
mustContain(mainTs, [
  "appendSwitch('overscroll-history-navigation', '0')",
  'OverscrollHistoryNavigation',
  'trunk:reportBubbleState',
  'activeBubbleCount',
  'bubbleVisibleByMonitor',
]);
mustContain(path.join(app, 'electron', 'preload.ts'), [
  'reportBubbleState',
  'trunk:reportBubbleState',
  'trunk:bubble-aggregate',
  'activeBubbleCount',
]);

mustNotContain(mainTs, ['setIgnoreMouseEvents', 'globalShortcut']);
mustNotContain(path.join(app, 'electron', 'production', 'managementConsole.html'), ['setIgnoreMouseEvents']);
mustNotContain(controller, ['setIgnoreMouseEvents', 'twoFingerMode', 'beginPinchIfNeeded']);

const controllerText = fs.readFileSync(controller, 'utf8');
if (!/private pointers = new Map/.test(controllerText)) {
  fail('gesture pointers must stay instance state (per ExploreController / window)');
}
if (/^(?:const|let|var) pointers\s*=\s*new Map/m.test(controllerText)) {
  fail('gesture pointers must not be a module-level global Map');
}
if (/^(?:const|let|var) (bubbleVisible|revealUniforms)\s*=/m.test(controllerText)) {
  fail('bubble state must stay instance fields, not module-level globals');
}
if (!controllerText.includes('this.nativeTouchCount = e.touches.length')) {
  fail('TouchEvent touches.length must drive nativeTouchCount');
}

const panBlock = controllerText.slice(
  controllerText.indexOf('// 1本指のみ camera X/Y pan'),
  controllerText.indexOf('private finishPointer'),
);
if (!panBlock.includes("this.gestureMode === 'one-finger'")) {
  fail('camera XY pan must stay gated on one-finger');
}
if (!panBlock.includes('this.nativeTouchCount <= 1') || !panBlock.includes('this.effectiveFingerCount() === 1')) {
  fail('camera XY pan must require nativeTouchCount/effectiveFingerCount of 1');
}
if (panBlock.includes('this.pointers.size >= 2') && panBlock.includes('targetCameraX')) {
  fail('2-finger path must not assign targetCameraX');
}

const css = fs.readFileSync(path.join(src, 'styles.css'), 'utf8');
if (!/html,\s*body,\s*#root \{[\s\S]*touch-action: none/.test(css)) {
  fail('html/body/#root must set touch-action: none');
}

if (process.exitCode) {
  console.error('production phase 7.4 check failed');
  process.exit(process.exitCode);
}
console.info('production phase 7.4 check ok');
