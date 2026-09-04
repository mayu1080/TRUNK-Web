'use strict';

/**
 * Production Phase 7.6: cross-monitor LIST camera isolation.
 * From app/ after `npm run build`: npm run check:production-phase76
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
const appTsx = path.join(src, 'App.tsx');
const mainTs = path.join(app, 'electron', 'main.ts');
const coordinator = path.join(app, 'electron', 'production', 'productionStateCoordinator.ts');
const session = path.join(app, 'shared', 'localGestureSession.ts');

mustContain(session, [
  'interactionSessionId',
  'decideOneFingerPanMove',
  'stale-start-replay-ignored',
  'localBubbleFingerGate',
  'simulateTwoMonitorPanIsolation',
  'CAMERA_PAN_DEBUG_RING = 8',
]);
mustContain(controller, [
  'interactionSessionId',
  'decideOneFingerPanMove',
  'pointerEventBelongsHere',
  'duplicate-pointerdown-kept',
  'stale-start-replay-ignored',
  'localBubbleFingerGate',
  'CAMERA_PAN_DEBUG_RING',
  'ownerMonitorId',
  'ownerWindowId',
  'isDuplicateLocalPointerDown',
]);
mustContain(controller, [
  'Keep local touch sessions',
  'p.sessionId !== this.interactionSessionId',
  'Pan is gated on this window\'s interactionSessionId',
]);
mustContain(host, [
  'Do not depend on production snapshot / idle / activity IPC',
]);
mustContain(appTsx, [
  'listGestureIdentity',
  "action.type === 'REPORT_TOUCH_ACTIVITY'",
  'if (!debugModeRef.current) return',
  'interactionSessionId',
  'cameraPanDebug',
]);
mustContain(mainTs, [
  'activityOnly',
  'if (!activityOnly)',
  'Do not fan out snapshots',
]);
mustContain(coordinator, [
  'Global 120s idle only',
  "touch activity monitor=",
]);

mustNotContain(mainTs, [
  'forwardTouch',
  'sendInputEvent',
  'trunk:forward-touch',
  'synthesizePointer',
  'fake-split',
]);
mustNotContain(controller, [
  'getAllWindows().forEach',
  'webContents.sendInputEvent',
  'globalThis.pointers',
]);
mustNotContain(appTsx, [
  'sendInputEvent',
  'forwardTouch',
]);

const controllerText = fs.readFileSync(controller, 'utf8');
if (/^(?:const|let|var) pointers\s*=\s*new Map/m.test(controllerText)) {
  fail('gesture pointers must not be a module-level global Map');
}
if (!/private interactionSessionId/.test(controllerText)) {
  fail('interactionSessionId must be an ExploreController instance field');
}
if (controllerText.includes('this.pointers.clear();\n    this.nativeTouchCount = 0;\n    this.resetPinchTracking();\n    this.bubbleContactActive = false;')) {
  fail('onWindowBlur must not clear local touch pointers');
}

const panBlock = controllerText.slice(
  controllerText.indexOf('// 1本指のみ camera X/Y pan'),
  controllerText.indexOf('private finishPointer'),
);
if (!panBlock.includes('decideOneFingerPanMove')) {
  fail('camera XY pan must call decideOneFingerPanMove (local session gate)');
}
if (!panBlock.includes('interactionSessionId')) {
  fail('camera XY pan must be gated by local interactionSessionId');
}

const bubbleBlock = controllerText.slice(
  controllerText.indexOf('private isBubbleAllowed'),
  controllerText.indexOf('private scheduleHideBubble'),
);
if (!bubbleBlock.includes('localBubbleFingerGate')) {
  fail('bubble show path must use localBubbleFingerGate, not a global finger count');
}

const mainText = fs.readFileSync(mainTs, 'utf8');
if (!mainText.includes('if (!activityOnly)') || !mainText.includes('broadcastAll')) {
  fail('touch activity must skip production snapshot broadcastAll');
}
if (/webContents\.send\([^)]*clientX/.test(mainText) && mainText.includes("webContents.send('trunk:production-state-changed'")) {
  fail('production-state-changed must not carry pointer clientX');
}

const distSession = path.join(app, 'dist', 'shared', 'localGestureSession.js');
if (!fs.existsSync(distSession)) {
  fail('run npm run build first so dist/shared/localGestureSession.js exists');
} else {
  const { simulateTwoMonitorPanIsolation, localBubbleFingerGate, eventBelongsToWindow } = require(distSession);
  const sim = simulateTwoMonitorPanIsolation();
  if (sim.m1Moved) {
    fail('M3 down / stale start replay must not pan M1 while M1 finger is held still');
  }
  if (!sim.m3Moved) {
    fail('M3 local 1-finger drag must still pan M3');
  }
  if (localBubbleFingerGate(1) !== 'show' || localBubbleFingerGate(2) !== 'hide-multi' || localBubbleFingerGate(0) !== 'release') {
    fail('bubble gate must be local 1-finger show / 2+ hide / 0 release');
  }
  if (eventBelongsToWindow({ viewIsThisWindow: false, clientX: 10, clientY: 10, viewportWidth: 1080, viewportHeight: 1920 })) {
    fail('foreign window view must not belong to this window');
  }
  if (!eventBelongsToWindow({ viewIsThisWindow: true, clientX: 10, clientY: 10, viewportWidth: 1080, viewportHeight: 1920 })) {
    fail('local in-bounds pointer must belong to this window');
  }
}

if (process.exitCode) {
  console.error('production phase 7.6 check failed');
  process.exit(process.exitCode);
}
console.info('production phase 7.6 check ok');
