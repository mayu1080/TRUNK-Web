'use strict';

/**
 * Production Phase 5.14: Category modal as a white card gallery (not full-screen cream).
 * From app/ after `npm run build`: npm run check:production-phase514
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
  console.error('production phase 5.14 overlay independence failed');
  process.exit(process.exitCode);
}

const src = path.join(__dirname, '..', 'renderer', 'production', 'src');
const contentRoot = process.env.TRUNK_CONTENT_ROOT?.trim()
  ? path.resolve(process.env.TRUNK_CONTENT_ROOT.trim())
  : path.resolve(__dirname, '..', '..', 'content');

mustContain(path.join(src, 'overlays', 'CategoryModal.tsx'), [
  'open: boolean',
  'is-loop',
  'loopable',
  'is-single',
  'FLICK_PX_PER_MS',
  'SLIDE_PCT',
  'SQUARE_LOGO_RELATIVE_PATH',
  'categoryTitle',
  'categoryDescription',
  'CATEGORY_MODAL_MOTION',
  'stopScrollLeak',
]);
mustNotContain(path.join(src, 'overlays', 'CategoryModal.tsx'), ['LOGO_TEXT']);
mustContain(path.join(src, 'categoryModalMotion.ts'), [
  'SQUARE_LOGO_RELATIVE_PATH',
  'Logo/LOGO_Square.png',
  'DRAWER_MOTION.durationMs',
  'scale: 0.985',
]);
// Phase 5.16 以降、modal の title / description は sharedCopy（content/text/TOKYO FOOD.txt）優先で、
// 無いときだけ categories.json の値にフォールバックする。
mustContain(path.join(src, 'App.tsx'), [
  'open={modalOpen}',
  'categoryTitle={sharedCopy?.found ? sharedCopy.title : modalCategory?.title}',
  'categoryDescription={sharedCopy?.found ? sharedCopy.description : modalCategory?.description}',
  'CATEGORY_MODAL_MOTION',
]);
mustNotContain(path.join(src, 'App.tsx'), ['key={own.selectedCategoryId ?? \'modal\'}']);
mustContain(path.join(src, 'styles.css'), [
  'category-modal__card',
  'overscroll-behavior: contain',
  '-webkit-overflow-scrolling: touch',
  'touch-action: pan-y',
  'translateY(12px) scale(0.985)',
  'translateY(7.2px) scale(0.99)',
]);
mustNotContain(path.join(src, 'styles.css'), ['background: #f4f1ea']);
mustContain(path.join(src, 'overlays', 'ImageZoomOverlay.tsx'), ['image-zoom-overlay__card']);
mustContain(path.join(src, 'ui', 'CategoryDrawer.tsx'), ['DRAWER_MOTION']);
mustContain(path.join(src, 'ui', 'BoxLogo.tsx'), ['stopPropagation']);
mustContain(path.join(__dirname, '..', 'shared', 'types.ts'), ['title?: string', 'description?: string']);
mustContain(path.join(__dirname, '..', 'shared', 'idleConfig.ts'), ['PRODUCTION_SHELL_IDLE_TIMEOUT_SECONDS = 120']);
mustContain(path.join(__dirname, '..', 'shared', 'productionState.ts'), [
  "interactionLocked: state.localOverlay !== 'NONE'",
]);

const squareLogo = path.join(contentRoot, 'Logo', 'LOGO_Square.png');
if (!fs.existsSync(squareLogo)) {
  fail(`missing Square logo at ${squareLogo}`);
}

const categories = JSON.parse(fs.readFileSync(path.join(contentRoot, 'categories.json'), 'utf8'));
for (const id of ['food', 'gift', 'flower']) {
  const row = categories.find((item) => item.id === id);
  if (!row) fail(`category ${id} missing`);
  if (typeof row.title !== 'string' || !row.title.trim()) fail(`category ${id} title missing`);
  if (typeof row.description !== 'string' || !row.description.trim()) fail(`category ${id} description missing`);
}

if (process.exitCode) {
  console.error('production phase 5.14 check failed');
  process.exit(process.exitCode);
}
console.info('production phase 5.14 check ok');
