'use strict';

/**
 * Production Phase 7.1: LIST independent world / fullscreen bounds log / ads split.
 * From app/ after `npm run build`: npm run check:production-phase71
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

const root = path.join(__dirname, '..', '..');
const app = path.join(__dirname, '..');
const src = path.join(app, 'renderer', 'production', 'src');
const contentRoot = process.env.TRUNK_CONTENT_ROOT?.trim()
  ? path.resolve(process.env.TRUNK_CONTENT_ROOT.trim())
  : path.join(root, 'content');

// --- LIST independent world -------------------------------------------------
mustContain(path.join(src, 'listConfig.ts'), [
  "listWorldMode: 'independent'",
  'worldScaleMultiplierX: 4',
  'worldScaleMultiplierY: 4',
  'worldSeedStride',
  'cardSpawnSpanMultiplier',
]);
mustContain(path.join(src, 'three', 'sceneLayout.ts'), [
  'resolveListWorld',
  'monitorWorldSeed',
  'wrapCentered',
  'wrapDelta',
  "mode: 'sharedWall'",
]);
mustContain(path.join(src, 'three', 'exploreController.ts'), [
  'wrapPanLoop',
  'respawnCardXY',
  'isCardOutOfSpawnBand',
  "this.world.mode === 'independent'",
]);
mustContain(path.join(src, 'types.ts'), ['listWorldMode', 'worldWidth', 'worldHeight', 'worldSeed']);
mustContain(path.join(src, 'App.tsx'), ['listWorldMode', 'panWrap', 'camera.aspect']);

// production default は independent。sharedWall は退避 flag として残す。
const listConfigText = fs.readFileSync(path.join(src, 'listConfig.ts'), 'utf8');
if (!listConfigText.includes("'independent' | 'sharedWall'")) {
  fail('listConfig.ts must keep the sharedWall feature flag union');
}

// independent では monitor-layout の viewportOffset を camera に足さない。
const controllerText = fs.readFileSync(path.join(src, 'three', 'exploreController.ts'), 'utf8');
const independentBlock = controllerText.slice(
  controllerText.indexOf('private applyLayoutOrigin'),
  controllerText.indexOf('} else {', controllerText.indexOf('private applyLayoutOrigin')),
);
if (independentBlock.includes('this.layout.viewportOffset')) {
  fail('independent world must not add viewportOffset to the LIST camera');
}

// LIST の pan は clamp ではなく wrap（端で止めない）。
if (!controllerText.includes('this.wrapPanLoop();')) {
  fail('exploreController must wrap pan instead of clamping in independent mode');
}

// --- fullscreen / bounds log ------------------------------------------------
mustContain(path.join(app, 'electron', 'main.ts'), [
  'frame: false',
  'setFullScreen(true)',
  'isKiosk: win.isKiosk()',
  'isFrameless',
  'frameOption',
  'initialBounds',
  'finalBounds',
  'getContentBounds',
  "boundsSource: 'display.bounds'",
]);
mustContain(path.join(app, 'electron', 'production', 'displayDump.ts'), [
  'scaleFactor',
  'workArea',
  'parseProductionFullscreen',
  'parseSiteAutoBounds',
]);
// preview 縮小設定が production 起動に混ざらないこと。本番起動は site 経路のみ。
mustContain(path.join(app, 'scripts', 'start-production-site.js'), [
  'TRUNK_PRODUCTION_FORCE_NO_PREVIEW',
  'delete process.env[key]',
  'TRUNK_SITE_AUTO_BOUNDS',
]);

// --- ads split mp4 ----------------------------------------------------------
mustContain(path.join(app, 'electron', 'production', 'videoPlaylist.ts'), [
  'videoPlaylistMode',
  "'split'",
  "'single-shared'",
  'fillMissingTracks',
  'Incomplete 2–3 files: keep missing tracks found:false (placeholder + warning). Do not fill with the first file.',
]);
mustContain(path.join(root, 'docs', 'production', 'production-runtime-spec.md'), [
  '欠落 monitor は placeholder',
  '先頭ファイルで埋めない',
]);
mustContain(path.join(app, 'electron', 'content', 'contentImageValidation.ts'), ['videoPlaylistMode(playlist)']);
mustContain(path.join(app, 'shared', 'types.ts'), ['adsVideoDurationMs']);
mustContain(path.join(src, 'App.tsx'), [
  'adsVideoMode',
  'adsVideoFile',
  'adsVideoFiles',
  'adsVideoDuration',
  'adsVideoReadyState',
]);

const adsJsonPath = path.join(contentRoot, 'ads.json');
if (!fs.existsSync(adsJsonPath)) {
  fail('content/ads.json missing');
} else {
  const ads = JSON.parse(fs.readFileSync(adsJsonPath, 'utf8'));
  const tracks = Array.isArray(ads.tracks) ? ads.tracks : [];
  for (const monitorId of [1, 2, 3, 4]) {
    const row = tracks.find((item) => Number(item?.monitorId) === monitorId);
    if (!row) fail(`ads.json must map monitorId ${monitorId}`);
    else if (row.file !== `ads/monitor-${monitorId}.mp4`) {
      fail(`ads.json monitorId ${monitorId} should point at ads/monitor-${monitorId}.mp4, got ${JSON.stringify(row.file)}`);
    }
  }
  const adsDir = path.join(contentRoot, 'ads');
  const found = [1, 2, 3, 4].filter((id) => fs.existsSync(path.join(adsDir, `monitor-${id}.mp4`)));
  console.info(`[info] ads split files present: ${found.length}/4 (${found.join(',') || 'none'})`);
  if (found.length > 0 && found.length < 4) {
    console.warn(`[warn] ads split incomplete — missing monitor-${[1, 2, 3, 4].filter((id) => !found.includes(id)).join(',')}.mp4`);
  }
}

// --- docs -------------------------------------------------------------------
mustContain(path.join(root, 'docs', 'production', 'production-runtime-spec.md'), [
  'LIST_WORLD_MODE',
  'independent',
  'sharedWall',
  'start:production:site',
  'monitor-1.mp4',
]);
mustContain(path.join(root, 'docs', 'production', 'phase7-site-preflight.md'), [
  'listWorldMode',
  'independent',
  'start:production:site',
]);

if (process.exitCode) {
  console.error('production phase 7.1 check failed');
  process.exit(process.exitCode);
}
console.info('production phase 7.1 check ok');
