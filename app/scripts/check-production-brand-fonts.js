'use strict';

/**
 * Maison Neue .otf from content/fonts/MaisonNeue via trunk-content://
 * From app/: npm run check:production-brand-fonts
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

require('./check-production-overlay.js');
if (process.exitCode) {
  console.error('production brand fonts overlay independence failed');
  process.exit(process.exitCode);
}

const src = path.join(__dirname, '..', 'renderer', 'production', 'src');
const contentRoot = process.env.TRUNK_CONTENT_ROOT?.trim()
  ? path.resolve(process.env.TRUNK_CONTENT_ROOT.trim())
  : path.resolve(__dirname, '..', '..', 'content');

mustContain(path.join(__dirname, '..', 'electron', 'content', 'brandFonts.ts'), [
  'fonts/MaisonNeue',
  'toContentRenderUrl',
  'weight: inferred.weight',
]);
mustContain(path.join(__dirname, '..', 'electron', 'content', 'contentProtocol.ts'), [
  "case '.otf'",
  'font/otf',
]);
mustContain(path.join(src, 'loadBrandFonts.ts'), [
  'format("opentype")',
  'document.fonts.check',
  'Maison Neue missing / fallback',
]);
mustContain(path.join(src, 'App.tsx'), ['loadMaisonNeue', 'fontFamily:', 'fontLoaded:', 'fontFallback:']);
mustContain(path.join(src, 'styles.css'), [
  'font-family: "Maison Neue", "Helvetica Neue", Arial, sans-serif',
]);
mustContain(path.join(src, 'ui', 'CategoryDrawer.tsx'), ['drawer-eyebrow', 'drawer-title']);
mustContain(path.join(src, 'overlays', 'CategoryModal.tsx'), ['category-modal__title']);
mustContain(path.join(__dirname, '..', 'shared', 'idleConfig.ts'), ['PRODUCTION_SHELL_IDLE_TIMEOUT_SECONDS = 120']);

const fontDir = path.join(contentRoot, 'fonts', 'MaisonNeue');
const required = [
  'MaisonNeue-Book.otf',
  'MaisonNeue-Medium.otf',
  'MaisonNeue-Demi.otf',
  'MaisonNeue-Bold.otf',
];
if (!fs.existsSync(fontDir)) {
  fail(`fonts dir missing: ${fontDir}`);
} else {
  for (const name of required) {
    if (!fs.existsSync(path.join(fontDir, name))) fail(`missing ${name}`);
  }
}

if (process.exitCode) {
  console.error('production brand fonts check failed');
  process.exit(process.exitCode);
}
console.info('production brand fonts check ok');
