'use strict';

/**
 * Production Phase 7.2: AD_IDLE loop + viewport clip so overlays stay inside each window.
 * From app/ after `npm run build`: npm run check:production-phase72
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

const src = path.join(__dirname, '..', 'renderer', 'production', 'src');
const css = fs.readFileSync(path.join(src, 'styles.css'), 'utf8');
const app = fs.readFileSync(path.join(src, 'App.tsx'), 'utf8');
const playlist = fs.readFileSync(
  path.join(__dirname, '..', 'electron', 'production', 'videoPlaylist.ts'),
  'utf8',
);

mustContain(path.join(src, 'styles.css'), [
  'overflow: hidden',
  'contain: layout paint size',
  'isolation: isolate',
  'max-width: min(320px, 100%)',
  'transform: translateX(100%)',
  'max-width: calc(100% - 32px)',
]);
mustNotContain(path.join(src, 'styles.css'), ['width: 100vw', 'calc(100vw / 3)', 'min(84vw, 760px)']);

const drawerBlock = css.slice(css.indexOf('.drawer-panel {'), css.indexOf('.drawer-root.is-open .drawer-panel'));
if (!drawerBlock.includes('right: 0')) fail('drawer-panel must stay right: 0');
if (!drawerBlock.includes('overflow: hidden')) fail('drawer-panel must clip overflow');
if (drawerBlock.includes('translateX(12px)')) fail('drawer-panel must not peek 12px past the window edge');

const modalCard = css.slice(css.indexOf('.category-modal__card {'), css.indexOf('.category-modal.is-open .category-modal__card'));
if (modalCard.includes('100vw')) fail('category-modal__card must not use 100vw');
if (!modalCard.includes('max-width: 100%')) fail('category-modal__card must cap at 100%');

mustContain(path.join(src, 'App.tsx'), [
  'el.loop = adsLoop',
  "current?.globalScene === 'AD_IDLE' && current.video.loop",
  'adsVideoLoop',
  'video.ended',
  'collectViewportDebug',
  'viewport overflow',
]);
mustContain(path.join(src, 'viewportDebug.ts'), [
  'innerWidth',
  'categoryDrawerRect',
  'imageZoomCardRect',
  'categoryModalRect',
  'widthMismatchWarning',
]);
mustContain(path.join(__dirname, '..', 'electron', 'production', 'videoPlaylist.ts'), [
  "kind === 'ads' ? raw?.loop !== false : false",
]);
if (!playlist.includes("kind === 'ads' && mediaMs != null")) {
  fail('ads playlist should use media duration for loop sync');
}

mustContain(path.join(src, 'three', 'exploreController.ts'), [
  "this.world.mode === 'independent'",
  'wrapPanLoop',
]);

if (process.exitCode) {
  console.error('production phase 7.2 check failed');
  process.exit(process.exitCode);
}
console.info('production phase 7.2 check ok');
