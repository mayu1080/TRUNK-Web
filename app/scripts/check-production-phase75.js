'use strict';

/**
 * Production Phase 7.5: touch routing debug (Case A vs Case B).
 * From app/ after `npm run build`: npm run check:production-phase75
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
const mainTs = path.join(app, 'electron', 'main.ts');
const preload = path.join(app, 'electron', 'preload.ts');
const appTsx = path.join(src, 'App.tsx');
const marker = path.join(src, 'ui', 'TouchMarker.tsx');
const routing = path.join(src, 'touchRoutingDebug.ts');
const styles = path.join(src, 'styles.css');
const overlay = path.join(src, 'ui', 'BubbleOverlay.tsx');
const host = path.join(src, 'three', 'ExploreHost.tsx');
const controller = path.join(src, 'three', 'exploreController.ts');

mustContain(marker, [
  'touch-marker--debug',
  'data-touch-marker',
  'M${monitorId} TOUCH',
  'Debug-only local hit marker',
]);
mustContain(routing, [
  'TOUCH_HIT_RING = 8',
  'TOUCH_MOVE_THROTTLE_MS',
  'lastTouchWindowId',
  'thisWindowId',
  'sharedDisplayId',
  'identicalBounds',
  'clientX',
  'screenX',
  'nativeTouchCount',
  'activePointerCount',
]);
mustContain(appTsx, [
  'TouchMarker',
  'isDebugMode(uiMode)',
  'lastTouchWindowId',
  'thisWindowId',
  'reportTouchHit',
  'onTouchRouting',
  'getWindowMapping',
  'sharedDisplayId',
  'identicalBounds',
  'touchHits',
  'nativeTouchCount',
]);
mustContain(styles, [
  '.touch-marker',
  '.review-mode .touch-marker',
]);
mustContain(mainTs, [
  'trunk:reportTouchHit',
  'trunk:touch-routing',
  'trunk:getWindowMapping',
  'lastTouchWindowId',
  'sharedDisplayId',
  'identicalBounds',
  'electronWindowId',
  'currentWindowMapping',
]);
mustContain(preload, [
  'reportTouchHit',
  'trunk:reportTouchHit',
  'trunk:touch-routing',
  'getWindowMapping',
  'onTouchRouting',
]);
mustContain(path.join(app, 'shared', 'types.ts'), [
  'TouchHitReport',
  'WindowMappingDump',
  'lastTouchWindowId',
  'reportTouchHit',
  'getWindowMapping',
  'onTouchRouting',
]);
mustContain(host, ['new ExploreController(', 'BubbleOverlay', 'layout.monitorId']);
mustContain(overlay, ['data-bubble-monitor-id']);
mustContain(controller, ['private bubbleVisible', 'lastTouchMonitorId']);

const fakeSplitNeedles = [
  'fake-split',
  'fake split',
  'split bubble from global',
  'fabricate routing',
  'sendInputEvent',
  'webContents.sendInputEvent',
  'forwardTouch',
  'trunk:forward-touch',
  'synthesizePointer',
  'digitizer remap',
];
mustNotContain(mainTs, fakeSplitNeedles);
mustNotContain(preload, fakeSplitNeedles);
mustNotContain(appTsx, fakeSplitNeedles);
mustNotContain(controller, fakeSplitNeedles);
mustNotContain(marker, fakeSplitNeedles);
mustNotContain(routing, fakeSplitNeedles);
mustNotContain(mainTs, ['setIgnoreMouseEvents']);

const mainText = fs.readFileSync(mainTs, 'utf8');
if (mainText.includes("webContents.send('trunk:touch-routing'") === false) {
  fail('main must broadcast last-hit metadata on trunk:touch-routing');
}
if (/sendInputEvent|forward.*[Tt]ouch.*other.*window/.test(mainText) && mainText.includes('sendInputEvent')) {
  fail('main must not forward physical touches into other BrowserWindows');
}

const markerText = fs.readFileSync(marker, 'utf8');
if (!markerText.includes('Debug-only')) {
  fail('TouchMarker must stay debug-only');
}

const appText = fs.readFileSync(appTsx, 'utf8');
if (!appText.includes('isDebugMode(uiMode)') || !appText.includes('<TouchMarker')) {
  fail('TouchMarker must render only when debug mode is on');
}

if (process.exitCode) {
  console.error('production phase 7.5 check failed');
  process.exit(process.exitCode);
}
console.info('production phase 7.5 check ok');
