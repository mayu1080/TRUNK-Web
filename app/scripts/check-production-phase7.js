'use strict';

/**
 * Production Phase 7: 4-window field-test prep (layout, overlay, scene, idle).
 * Does not require 4 physical displays. After `npm run build`: npm run check:production-phase7
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { resolveWindowPlacement } = require('../dist/electron/production/windowPlacement');

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

function runCheck(script) {
  const result = spawnSync(process.execPath, [path.join(__dirname, script)], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  });
  if (result.status) {
    process.exit(result.status);
  }
}

function display(id, x, y, width, height) {
  return {
    id,
    bounds: { x, y, width, height },
    workArea: { x, y, width, height },
  };
}

runCheck('check-production-overlay.js');
runCheck('check-production-phase2.js');

const root = path.join(__dirname, '..', '..');
const app = path.join(__dirname, '..');
const src = path.join(app, 'renderer', 'production', 'src');
const contentRoot = process.env.TRUNK_CONTENT_ROOT?.trim()
  ? path.resolve(process.env.TRUNK_CONTENT_ROOT.trim())
  : path.join(root, 'content');

const siteDocs = [
  'docs/production/phase7-site-preflight.md',
  'docs/production/phase7-site-qa-checklist.md',
  'docs/production/production-runtime-spec.md',
];
for (const rel of siteDocs) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) fail(`missing ${rel}`);
}
mustContain(path.join(root, 'docs/production/production-runtime-spec.md'), [
  'npm run start:production',
  '管理画面は 5 枚目の production window ではない',
  '120 秒 Non-Touch は 4 面全体判定',
]);
mustContain(path.join(root, 'README.md'), ['docs/production/phase7-site-preflight.md']);

const siteBats = [
  ['launch-production.bat', 'npm run start:production'],
  ['launch-production-preview.bat', 'npm run start:production:preview'],
  ['check-production-content.bat', 'npm run check:production-content'],
  ['build-production.bat', 'npm run build:production'],
];
for (const [name, needle] of siteBats) {
  const abs = path.join(root, name);
  if (!fs.existsSync(abs)) fail(`missing ${name}`);
  mustContain(abs, [needle, 'pause']);
}

const layoutPath = path.join(contentRoot, 'monitor-layout.json');
const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
if (!Array.isArray(layout.monitors) || layout.monitors.length !== 4) fail('monitor-layout.json must list 4 monitors');
if (layout.fatalOnBoundsMismatch !== false) {
  fail('field-test default must keep fatalOnBoundsMismatch=false until venue bounds are confirmed');
}
if (typeof layout.boundsTolerancePx !== 'number' || layout.boundsTolerancePx < 0) {
  fail('boundsTolerancePx must be a number');
}
for (const row of layout.monitors) {
  if (row.width !== 1080 || row.height !== 1920 || row.orientation !== 'portrait') {
    fail(`monitor ${row.monitorId} expected 1080x1920 portrait`);
  }
}

mustContain(path.join(src, 'App.tsx'), [
  "globalScene === 'ANIMATION' || globalScene === 'PRODUCT_LIST'",
  "type: 'AD_IDLE_TOUCH'",
  "type: 'ANIMATION_COMPLETE'",
  "type: 'REPORT_TOUCH_ACTIVITY'",
]);
mustContain(path.join(app, 'electron', 'main.ts'), ["type: 'GLOBAL_IDLE_TIMEOUT'"]);
mustNotContain(path.join(src, 'overlays', 'CategoryModal.tsx'), ['category-modal__dots']);
mustContain(path.join(src, 'overlays', 'CategoryModal.tsx'), ['stopScrollLeak']);
mustContain(path.join(app, 'shared', 'idleConfig.ts'), ['PRODUCTION_SHELL_IDLE_TIMEOUT_SECONDS = 120']);
mustContain(path.join(app, 'electron', 'production', 'videoPlaylist.ts'), ['skipOnTouch: false']);
mustContain(path.join(contentRoot, 'animation.json'), ['animation/LogoMotion_Trunk.mp4']);

const animation = JSON.parse(fs.readFileSync(path.join(contentRoot, 'animation.json'), 'utf8'));
if (animation.skipOnTouch === true) fail('animation.json must not skip on touch');
if (!Array.isArray(animation.tracks) || animation.tracks.length !== 4) fail('animation.json must have 4 tracks');

const unpackaged = { isPackaged: false };

const matched = resolveWindowPlacement(layout, [
  display(11, 0, 0, 1080, 1920),
  display(12, 1080, 0, 1080, 1920),
  display(13, 2160, 0, 1080, 1920),
  display(14, 3240, 0, 1080, 1920),
], unpackaged);
if (matched.boundsMismatch) fail('4 portrait 1080x1920 at layout coords should match');
if (matched.isDevFallback) fail('matched 4-screen must not use tiled fallback');
if (matched.windows.length !== 4) fail('matched placement should open 4 windows');
if (matched.shouldQuit) fail('matched placement must not quit');

const twoLandscape = resolveWindowPlacement(layout, [
  display(1, 0, 0, 1920, 1080),
  display(2, 1920, 0, 1920, 1080),
], unpackaged);
if (!twoLandscape.boundsMismatch) fail('2x landscape 1920x1080 must mismatch portrait layout');
if (!twoLandscape.isDevFallback) fail('fewer than 4 displays must tile 4 windows on primary (dev fallback)');
if (twoLandscape.windows.length !== 4) fail('dev fallback still opens 4 windows');
if (twoLandscape.shouldQuit) fail('fatalOnBoundsMismatch=false must not quit on mismatch');

const fourWrongSize = resolveWindowPlacement(layout, [
  display(21, 0, 0, 1920, 1080),
  display(22, 1920, 0, 1920, 1080),
  display(23, 3840, 0, 1920, 1080),
  display(24, 5760, 0, 1920, 1080),
], unpackaged);
if (!fourWrongSize.boundsMismatch) fail('4 landscape displays should mismatch portrait config');
if (fourWrongSize.isDevFallback) fail('4 physical displays should map 1:1 even when coords differ');
if (fourWrongSize.windows.length !== 4) fail('4 physical displays should still open 4 windows');
if (fourWrongSize.shouldQuit) fail('non-fatal mismatch must not quit');

const fatalLayout = { ...layout, fatalOnBoundsMismatch: true };
const fatalQuit = resolveWindowPlacement(fatalLayout, [display(1, 0, 0, 1920, 1080)], unpackaged);
if (!fatalQuit.shouldQuit) fail('fatalOnBoundsMismatch=true must quit when bounds do not match');

console.info(
  JSON.stringify(
    {
      layoutPath: path.relative(root, layoutPath),
      boundsTolerancePx: layout.boundsTolerancePx,
      fatalOnBoundsMismatch: layout.fatalOnBoundsMismatch,
      matchedFourPortrait: {
        boundsMismatch: matched.boundsMismatch,
        isDevFallback: matched.isDevFallback,
        windowCount: matched.windows.length,
      },
      thisStyleTwoLandscape: {
        boundsMismatch: twoLandscape.boundsMismatch,
        isDevFallback: twoLandscape.isDevFallback,
        windowCount: twoLandscape.windows.length,
        warning: twoLandscape.warnings.find((row) => row.startsWith('dev fallback')),
      },
      fourPhysicalWrongSize: {
        boundsMismatch: fourWrongSize.boundsMismatch,
        isDevFallback: fourWrongSize.isDevFallback,
        windowCount: fourWrongSize.windows.length,
      },
    },
    null,
    2,
  ),
);

if (process.exitCode) {
  console.error('production phase 7 check failed');
  process.exit(process.exitCode);
}
console.info('production phase 7 check ok');
