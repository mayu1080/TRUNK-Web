'use strict';

/**
 * Headless overlay-independence check for Production Phase 1.
 * Run after `npm run build` from app/: node scripts/check-production-overlay.js
 */
const {
  ProductionStateCoordinator,
} = require('../dist/electron/production/productionStateCoordinator');

function placement(monitorId) {
  return {
    monitorId,
    bounds: { x: 0, y: 0, width: 400, height: 700 },
    config: {
      monitorId,
      x: (monitorId - 1) * 1080,
      y: 0,
      width: 1080,
      height: 1920,
      orientation: 'portrait',
      viewportOffsetX: (monitorId - 1) * 1080,
      viewportOffsetY: 0,
      scale: 1,
    },
    matchedDisplayId: null,
    boundsMismatch: true,
  };
}

const placements = new Map([1, 2, 3, 4].map((id) => [id, placement(id)]));
const coordinator = new ProductionStateCoordinator(
  [1, 2, 3, 4],
  {
    isDevFallback: true,
    isPreviewMode: false,
    previewMode: 'off',
    previewScale: null,
    previewLogicalWidth: null,
    previewLogicalHeight: null,
    boundsMismatch: true,
    fatalOnBoundsMismatch: false,
    contentRoot: '(check)',
    layoutPath: '(check)',
    warnings: [],
    placements,
  },
  () => {},
);

function fail(message) {
  console.error(`[fail] ${message}`);
  process.exitCode = 1;
}

coordinator.dispatch(1, { type: 'SET_GLOBAL_SCENE', scene: 'PRODUCT_LIST' });
coordinator.dispatch(1, { type: 'OPEN_IMAGE_ZOOM', imageId: 'src_001' });

let dump = coordinator.dump();
if (dump.globalScene !== 'PRODUCT_LIST') fail(`expected PRODUCT_LIST, got ${dump.globalScene}`);
if (dump.adMode !== 'four-screen-synced-content') fail(`adMode ${dump.adMode}`);
if (!dump.monitors[0].interactionLocked) fail('monitor 1 should be locked');
if (dump.monitors.slice(1).some((m) => m.interactionLocked)) fail('monitors 2-4 must stay unlocked');
if (dump.monitors[0].localOverlay !== 'IMAGE_ZOOM') fail('monitor 1 overlay');
if (dump.monitors[0].selectedImageId !== 'src_001') fail('monitor 1 selectedImageId');
if (dump.monitors.slice(1).some((m) => m.localOverlay !== 'NONE')) fail('other overlays must stay NONE');

coordinator.dispatch(2, { type: 'OPEN_CATEGORY_DRAWER' });
coordinator.dispatch(3, { type: 'OPEN_CATEGORY_DRAWER' });
coordinator.dispatch(3, { type: 'OPEN_CATEGORY_MODAL', categoryId: 'gift' });

dump = coordinator.dump();
const byId = Object.fromEntries(dump.monitors.map((m) => [m.monitorId, m]));
if (byId[1].localOverlay !== 'IMAGE_ZOOM' || !byId[1].interactionLocked) fail('M1 zoom');
if (byId[1].selectedImageId !== 'src_001') fail('M1 keeps selectedImageId');
if (byId[2].localOverlay !== 'CATEGORY_DRAWER' || !byId[2].interactionLocked) fail('M2 drawer');
if (byId[3].localOverlay !== 'CATEGORY_MODAL' || !byId[3].interactionLocked) fail('M3 modal');
if (byId[3].selectedCategoryId !== 'gift') fail('M3 selectedCategoryId');
if (byId[4].localOverlay !== 'NONE' || byId[4].interactionLocked) fail('M4 must stay free');

coordinator.dispatch(1, { type: 'CLOSE_OVERLAY' });
dump = coordinator.dump();
const afterClose = Object.fromEntries(dump.monitors.map((m) => [m.monitorId, m]));
if (afterClose[1].localOverlay !== 'NONE' || afterClose[1].interactionLocked) fail('M1 close should unlock only M1');
if (afterClose[1].selectedImageId != null) fail('M1 close should clear selectedImageId');
if (afterClose[2].localOverlay !== 'CATEGORY_DRAWER') fail('M2 drawer must survive M1 close');
if (afterClose[3].localOverlay !== 'CATEGORY_MODAL') fail('M3 modal must survive M1 close');

coordinator.dispatch(1, { type: 'SET_GLOBAL_SCENE', scene: 'AD_IDLE' });
dump = coordinator.dump();
if (dump.globalScene !== 'AD_IDLE') fail('return AD_IDLE');
if (dump.monitors.some((m) => m.localOverlay !== 'NONE' || m.interactionLocked)) {
  fail('global AD_IDLE must clear all overlays');
}

if (process.exitCode) {
  console.error('production overlay independence check failed');
  process.exit(process.exitCode);
}
console.info('production overlay independence check ok');
console.info(JSON.stringify(dump, null, 2));
