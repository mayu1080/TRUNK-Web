'use strict';

/**
 * Production Phase 5.5: preview placement + preload + noise mp4 + drawer/modal/logo markers.
 * From app/ after `npm run build`: npm run check:production-phase55
 */
const fs = require('node:fs');
const path = require('node:path');
const { resolveWindowPlacement } = require('../dist/electron/production/windowPlacement');
const { parseProductionPreviewConfig } = require('../dist/electron/production/previewConfig');
const { resolveNoiseAsset } = require('../dist/electron/production/noiseAsset');
const { collectCategoryImages } = require('../dist/electron/content/exploreImageCollector');

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
    if (!text.includes(needle)) {
      fail(`${path.relative(path.join(__dirname, '..'), filePath)} missing ${JSON.stringify(needle)}`);
    }
  }
  return text;
}

function mustNotContain(filePath, needles) {
  const text = fs.readFileSync(filePath, 'utf8');
  for (const needle of needles) {
    if (text.includes(needle)) {
      fail(`${path.relative(path.join(__dirname, '..'), filePath)} should not contain ${JSON.stringify(needle)}`);
    }
  }
}

require('./check-production-overlay.js');
if (process.exitCode) {
  console.error('production phase 5.5 overlay independence failed');
  process.exit(process.exitCode);
}

const packaged = parseProductionPreviewConfig(
  { TRUNK_PRODUCTION_PREVIEW_MODE: 'portrait' },
  { isPackaged: true },
);
if (packaged.mode !== 'off') fail('packaged preview must stay off');

const previewCfg = parseProductionPreviewConfig(
  { TRUNK_PRODUCTION_PREVIEW_MODE: 'portrait', TRUNK_PRODUCTION_PREVIEW_SCALE: '0.5' },
  { isPackaged: false },
);
if (previewCfg.mode !== 'portrait' || previewCfg.requestedScale !== 0.5) fail('preview env parse');
if (previewCfg.windows !== 'multi') fail('preview without WINDOWS env should default to multi (4-window regression)');
if (previewCfg.frame !== false) fail('preview frame default must be frameless');
const framedCfg = parseProductionPreviewConfig(
  { TRUNK_PRODUCTION_PREVIEW_MODE: 'portrait', TRUNK_PRODUCTION_PREVIEW_FRAME: '1' },
  { isPackaged: false },
);
if (framedCfg.frame !== true) fail('TRUNK_PRODUCTION_PREVIEW_FRAME=1 should enable title bar');

const layout = {
  boundsTolerancePx: 8,
  fatalOnBoundsMismatch: false,
  monitors: [1, 2, 3, 4].map((monitorId) => ({
    monitorId,
    x: (monitorId - 1) * 1080,
    y: 0,
    width: 1080,
    height: 1920,
    orientation: 'portrait',
    viewportOffsetX: (monitorId - 1) * 1080,
    viewportOffsetY: 0,
    scale: 1,
  })),
};
const displays = [
  {
    id: 11,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1032 },
  },
];
const previewPlacement = resolveWindowPlacement(layout, displays, {
  isPackaged: false,
  preview: previewCfg,
});
if (!previewPlacement.isPreviewMode) fail('preview placement should be preview mode');
if (previewPlacement.isDevFallback) fail('preview must be distinct from dev fallback');
if (previewPlacement.windows.length !== 4) fail('preview should tile 4 windows');
if (previewPlacement.windows[0].bounds.width !== 540) fail(`preview width ${previewPlacement.windows[0].bounds.width} != 540`);
if (previewPlacement.windows[0].bounds.height !== 960) fail(`preview height ${previewPlacement.windows[0].bounds.height} != 960`);
if (previewPlacement.previewWindows !== 'multi') fail('4-window preview should report previewWindows=multi');

const singleCfg = parseProductionPreviewConfig(
  { TRUNK_PRODUCTION_PREVIEW_MODE: 'portrait', TRUNK_PRODUCTION_PREVIEW_WINDOWS: 'single' },
  { isPackaged: false },
);
if (singleCfg.windows !== 'single') fail('single windows parse');
const singlePlacement = resolveWindowPlacement(layout, displays, {
  isPackaged: false,
  preview: singleCfg,
});
if (!singlePlacement.isPreviewMode) fail('single preview should be preview mode');
if (singlePlacement.isDevFallback) fail('single preview must be distinct from dev fallback');
if (singlePlacement.windows.length !== 1) fail(`single preview windows ${singlePlacement.windows.length} != 1`);
if (singlePlacement.windows[0].monitorId !== 1) fail(`single preview monitorId ${singlePlacement.windows[0].monitorId} != 1`);
if (singlePlacement.previewWindows !== 'single') fail('single preview should report previewWindows=single');
if (singlePlacement.previewFrame !== false) fail('single preview default must be frameless');
if (singlePlacement.previewLogicalWidth !== 1080 || singlePlacement.previewLogicalHeight !== 1920) {
  fail(`single preview logical ${singlePlacement.previewLogicalWidth}x${singlePlacement.previewLogicalHeight} != 1080x1920`);
}

const fallbackPlacement = resolveWindowPlacement(layout, displays, {
  isPackaged: false,
  preview: { mode: 'off', windows: 'multi', requestedScale: null, frame: false },
});
if (!fallbackPlacement.isDevFallback) fail('no-preview 1-display should stay small fallback');
if (fallbackPlacement.isPreviewMode) fail('fallback must not be preview');

const src = path.join(__dirname, '..', 'renderer', 'production', 'src');
mustNotContain(path.join(src, 'three', 'ExploreHost.tsx'), ['loading content images']);
mustContain(path.join(src, 'App.tsx'), [
  'is-preload',
  'listPreloadStatus',
  "own.localOverlay === 'NONE'",
  'mode="bars"',
  'debug-toggle',
  'debugVisible',
]);
mustContain(path.join(src, 'overlays', 'CategoryModal.tsx'), ['is-loop', 'loopable']);
mustContain(path.join(src, 'ui', 'NoiseOverlay.tsx'), ['getNoiseAsset', 'fallback-dom', 'listConfig.noiseEnabled']);
mustContain(path.join(src, 'styles.css'), ['background: #fff;', '.list-stage.is-preload']);
mustContain(path.join(__dirname, '..', 'electron', 'production', 'previewConfig.ts'), [
  'TRUNK_PRODUCTION_PREVIEW_MODE',
  'TRUNK_PRODUCTION_PREVIEW_SCALE',
  'TRUNK_PRODUCTION_PREVIEW_WINDOWS',
  'TRUNK_PRODUCTION_PREVIEW_FRAME',
]);
mustContain(path.join(__dirname, '..', 'package.json'), [
  'start:production:preview:single',
  'start:production:preview:multi',
]);
mustContain(path.join(__dirname, '..', 'scripts', 'start-production-preview.js'), [
  'TRUNK_PRODUCTION_PREVIEW_WINDOWS',
]);
mustContain(path.join(__dirname, '..', 'electron', 'main.ts'), [
  "previewWindows === 'single'",
  "scene: 'PRODUCT_LIST'",
]);
mustContain(path.join(__dirname, '..', 'shared', 'idleConfig.ts'), ['PRODUCTION_SHELL_IDLE_TIMEOUT_SECONDS = 120']);
mustContain(path.join(__dirname, '..', 'shared', 'productionState.ts'), [
  "interactionLocked: state.localOverlay !== 'NONE'",
]);

const exploreHost = fs.readFileSync(path.join(src, 'App.tsx'), 'utf8');
if (!exploreHost.includes("globalScene === 'ANIMATION' || globalScene === 'PRODUCT_LIST'")) {
  fail('LIST preload must mount during ANIMATION');
}

const contentRoot = resolveContentRoot();
const noise = resolveNoiseAsset(contentRoot);
console.info('noise asset', noise);
if (noise.found === false && !noise.warning) fail('missing noise should warn');

const categories = JSON.parse(fs.readFileSync(path.join(contentRoot, 'categories.json'), 'utf8'));
const flower = categories.find((row) => row.id === 'flower');
if (!flower) fail('flower category missing');
const flowerCount = collectCategoryImages(contentRoot, flower).length;
if (flowerCount < 1) fail('flower gallery must have at least 1 image');
console.info('flower gallery count:', flowerCount);

if (process.exitCode) {
  console.error('production phase 5.5 check failed');
  process.exit(process.exitCode);
}
console.info('production phase 5.5 check ok');
console.info(
  JSON.stringify(
    {
      previewWindow: previewPlacement.windows[0].bounds,
      previewScale: previewPlacement.previewScale,
      previewWindows: previewPlacement.previewWindows,
      singleWindow: singlePlacement.windows[0].bounds,
      singleMonitorId: singlePlacement.windows[0].monitorId,
      fallbackIsDevFallback: fallbackPlacement.isDevFallback,
      noiseFound: noise.found,
    },
    null,
    2,
  ),
);
