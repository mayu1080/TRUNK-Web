'use strict';

/**
 * Production Phase 5.15: Category modal card wider/shorter, Square logo 1.5x on white plate.
 * From app/ after `npm run build`: npm run check:production-phase515
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

require('./check-production-overlay.js');
if (process.exitCode) {
  console.error('production phase 5.15 overlay independence failed');
  process.exit(process.exitCode);
}

const src = path.join(__dirname, '..', 'renderer', 'production', 'src');

mustContain(path.join(src, 'styles.css'), [
  'flex: 0 0 76%',
  'width: 100%',
  'height: 71vh',
  'max-height: min(71vh, calc(100% - 24px))',
  'clamp(78px, 9.6vh, 108px)',
  'overscroll-behavior: contain',
  'touch-action: pan-y',
]);
mustContain(path.join(src, 'overlays', 'CategoryModal.tsx'), [
  'SQUARE_LOGO_RELATIVE_PATH',
  'category-modal__card',
  'stopScrollLeak',
  'SLIDE_PCT = 76',
]);
mustNotContain(path.join(src, 'overlays', 'CategoryModal.tsx'), ['LOGO_TEXT']);
mustContain(path.join(src, 'overlays', 'ImageZoomOverlay.tsx'), [
  'image-zoom-overlay__card',
]);
mustContain(path.join(src, 'styles.css'), [
  'height: min(80%, 1320px)',
  'width: min(84%, 760px)',
]);
mustContain(path.join(src, 'ui', 'CategoryDrawer.tsx'), ['DRAWER_MOTION']);
mustContain(path.join(__dirname, '..', 'shared', 'idleConfig.ts'), ['PRODUCTION_SHELL_IDLE_TIMEOUT_SECONDS = 120']);
mustContain(path.join(__dirname, '..', 'shared', 'productionState.ts'), [
  "interactionLocked: state.localOverlay !== 'NONE'",
]);

const css = fs.readFileSync(path.join(src, 'styles.css'), 'utf8');
const cardBlock = css.slice(css.indexOf('.category-modal__card {'), css.indexOf('.category-modal.is-open .category-modal__card'));
if (cardBlock.includes('max-width: 760px')) fail('category modal card still has max-width 760px');
if (cardBlock.includes('min(84vw')) fail('category modal card still uses min(84vw)');
if (cardBlock.includes('min(74vh')) fail('category modal card still uses min(74vh)');
if (cardBlock.includes('min(68vh')) fail('category modal card still uses min(68vh)');

const logoBlock = css.slice(css.indexOf('.category-modal__card .box-logo {'), css.indexOf('.category-modal__close-glyph'));
if (!logoBlock.includes('background: #fff')) fail('category modal box-logo should have white plate');
if (logoBlock.includes('background: transparent')) fail('category modal box-logo should not be transparent');
if (logoBlock.includes('invert(')) fail('do not invert LOGO_Square');

if (process.exitCode) {
  console.error('production phase 5.15 check failed');
  process.exit(process.exitCode);
}
console.info('production phase 5.15 check ok');
