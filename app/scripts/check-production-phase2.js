'use strict';

/**
 * Headless Phase 2 check: AD_IDLE_TOUCH, ANIMATION_COMPLETE, global idle timeout.
 * Run after `npm run build` from app/: node scripts/check-production-phase2.js
 */
const {
  ProductionStateCoordinator,
} = require('../dist/electron/production/productionStateCoordinator');
const { VideoSyncController } = require('../dist/electron/production/videoSyncController');
const { TouchActivityManager } = require('../dist/electron/production/touchActivityManager');

function fail(message) {
  console.error(`[fail] ${message}`);
  process.exitCode = 1;
}

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

function makeCoordinator() {
  const placements = new Map([1, 2, 3, 4].map((id) => [id, placement(id)]));
  return new ProductionStateCoordinator(
    [1, 2, 3, 4],
    {
      isDevFallback: true,
      boundsMismatch: true,
      fatalOnBoundsMismatch: false,
      contentRoot: '(check)',
      layoutPath: '(check)',
      warnings: [],
      placements,
    },
    () => {},
  );
}

function fakePlaylist(kind, durationMs) {
  return {
    kind,
    contentId: kind === 'ads' ? 'ad-wall' : 'animation-entry',
    loop: kind === 'ads',
    skipOnTouch: false,
    durationMs,
    safetyCapMs: durationMs + 50,
    fatalIfMissing: false,
    endPolicy: 'duration',
    jsonPath: null,
    tracks: [1, 2, 3, 4].map((monitorId) => ({
      monitorId,
      relativePath: `${kind}/monitor-${monitorId}.mp4`,
      url: null,
      found: false,
    })),
    warnings: [],
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const coordinator = makeCoordinator();

  if (coordinator.getGlobalScene() !== 'AD_IDLE') fail('start AD_IDLE');

  coordinator.dispatch(2, { type: 'AD_IDLE_TOUCH' });
  if (coordinator.getGlobalScene() !== 'ANIMATION') fail('any-monitor AD_IDLE_TOUCH → ANIMATION');

  coordinator.dispatch(3, { type: 'AD_IDLE_TOUCH' });
  if (coordinator.getGlobalScene() !== 'ANIMATION') fail('AD_IDLE_TOUCH during ANIMATION is a no-op');

  coordinator.dispatch(1, { type: 'ANIMATION_COMPLETE' });
  if (coordinator.getGlobalScene() !== 'PRODUCT_LIST') fail('ANIMATION_COMPLETE → PRODUCT_LIST');

  coordinator.dispatch(1, { type: 'OPEN_IMAGE_ZOOM' });
  coordinator.dispatch(1, { type: 'ANIMATION_COMPLETE' });
  if (coordinator.getGlobalScene() !== 'PRODUCT_LIST') fail('ANIMATION_COMPLETE no-op on LIST');
  if (coordinator.dump().monitors[0].localOverlay !== 'IMAGE_ZOOM') {
    fail('ANIMATION_COMPLETE no-op must not clear overlays');
  }

  coordinator.dispatch(4, { type: 'REPORT_TOUCH_ACTIVITY' });
  if (coordinator.getGlobalScene() !== 'PRODUCT_LIST') fail('REPORT_TOUCH_ACTIVITY must stay LIST');

  coordinator.dispatch(1, { type: 'GLOBAL_IDLE_TIMEOUT' });
  const afterIdle = coordinator.dump();
  if (afterIdle.globalScene !== 'AD_IDLE') fail('GLOBAL_IDLE_TIMEOUT → AD_IDLE');
  if (afterIdle.monitors.some((m) => m.localOverlay !== 'NONE' || m.interactionLocked)) {
    fail('idle return must clear overlays');
  }

  coordinator.dispatch(1, { type: 'GLOBAL_IDLE_TIMEOUT' });
  if (coordinator.getGlobalScene() !== 'AD_IDLE') fail('GLOBAL_IDLE_TIMEOUT no-op on AD_IDLE');

  let finished = 0;
  const video = new VideoSyncController(
    fakePlaylist('ads', 15000),
    fakePlaylist('animation', 40),
    () => {
      finished += 1;
    },
    () => {},
  );
  video.onScene('AD_IDLE');
  const adSession = video.sessionFor(1);
  if (adSession.scene !== 'AD_IDLE' || adSession.loop !== true || adSession.skipOnTouch !== false) {
    fail('AD_IDLE session');
  }
  video.onScene('ANIMATION');
  const animSession = video.sessionFor(3);
  if (animSession.scene !== 'ANIMATION' || animSession.loop !== false || animSession.sessionId === adSession.sessionId) {
    fail('ANIMATION session');
  }
  await wait(80);
  if (finished !== 1) fail(`animation duration should fire once, got ${finished}`);
  video.onScene('PRODUCT_LIST');
  if (video.sessionFor(1).scene !== 'none') fail('PRODUCT_LIST stops video');
  video.destroy();

  let mediaEndedEarly = 0;
  const mediaVideo = new VideoSyncController(
    fakePlaylist('ads', 15000),
    {
      ...fakePlaylist('animation', 40),
      endPolicy: 'media-ended',
      safetyCapMs: 200,
      tracks: [1, 2, 3, 4].map((monitorId) => ({
        monitorId,
        relativePath: 'animation/LogoMotion_Trunk.mp4',
        url: 'x',
        found: true,
      })),
    },
    () => {
      mediaEndedEarly += 1;
    },
    () => {},
  );
  mediaVideo.onScene('ANIMATION');
  await wait(80);
  if (mediaEndedEarly !== 0) fail('found animation mp4 must not complete at json durationMs (preload/timer cut)');
  await wait(180);
  if (mediaEndedEarly !== 1) fail(`animation safety cap should finish media-ended session, got ${mediaEndedEarly}`);
  mediaVideo.destroy();

  let timedOut = false;
  const idle = new TouchActivityManager(
    () => 0.05,
    'development',
    () => {
      timedOut = true;
    },
  );
  idle.onScene('AD_IDLE');
  await wait(80);
  if (timedOut) fail('idle must not arm on AD_IDLE');
  idle.onScene('PRODUCT_LIST');
  idle.noteValidTouch();
  await wait(20);
  if (timedOut) fail('idle must reset on valid touch');
  await wait(80);
  if (!timedOut) fail('idle should fire after timeoutSeconds');
  idle.onScene('AD_IDLE');
  idle.destroy();

  if (process.exitCode) {
    console.error('production phase 2 check failed');
    process.exit(process.exitCode);
  }
  console.info('production phase 2 check ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
