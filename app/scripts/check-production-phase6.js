'use strict';

/**
 * Production Phase 6: content wiring (list/text/cover/animation) + debug + validation.
 * From app/ after `npm run build`: npm run check:production-phase6
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
  console.error('production phase 6 overlay independence failed');
  process.exit(process.exitCode);
}

const root = path.join(__dirname, '..', '..');
const app = path.join(__dirname, '..');
const src = path.join(app, 'renderer', 'production', 'src');
const contentRoot = process.env.TRUNK_CONTENT_ROOT?.trim()
  ? path.resolve(process.env.TRUNK_CONTENT_ROOT.trim())
  : path.join(root, 'content');

mustContain(path.join(src, 'App.tsx'), [
  'listImageCount',
  'listSourceMode',
  'categoryFoodFolderCount',
  'categoryFoodSlideCount',
  'coverImageCount',
  'textLoaded',
  'textSource',
  'animationVideoMode',
  'animationVideoFiles',
]);
mustContain(path.join(app, 'electron', 'content', 'categoryGallery.ts'), [
  'contentFolderLabels',
  'hyoshi',
]);
mustNotContain(path.join(src, 'overlays', 'CategoryModal.tsx'), [
  'category-modal__dots',
  'category-modal__dot',
]);
mustContain(path.join(src, 'imageCopy.ts'), ['TOKYO FOOD.txt', 'sharedTitle']);
mustContain(path.join(src, 'contentCards.ts'), ['instanceId', 'sourceImageId', 'seededShuffle']);
mustContain(path.join(app, 'electron', 'production', 'videoPlaylist.ts'), [
  'fillMissingAnimationTracks',
  'using ${files[0]} on all monitors',
]);
mustContain(path.join(app, 'electron', 'content', 'contentImageValidation.ts'), [
  'foodFolderCount',
  'coverImageCount',
  'textLoaded',
  'animationVideoMode',
  'fontsDirExists',
]);
mustContain(path.join(app, 'shared', 'idleConfig.ts'), ['PRODUCTION_SHELL_IDLE_TIMEOUT_SECONDS = 120']);

const distValidation = path.join(app, 'dist', 'electron', 'content', 'contentImageValidation.js');
const distGallery = path.join(app, 'dist', 'electron', 'content', 'categoryGallery.js');
const distPlaylist = path.join(app, 'dist', 'electron', 'production', 'videoPlaylist.js');
if (!fs.existsSync(distValidation) || !fs.existsSync(distGallery) || !fs.existsSync(distPlaylist)) {
  fail('run npm run build before check:production-phase6 (dist missing)');
} else {
  const { validateProductionContentImages } = require(distValidation);
  const { buildCategoryGallery } = require(distGallery);
  const { loadVideoPlaylist } = require(distPlaylist);
  const report = validateProductionContentImages(contentRoot);
  if (!report.listDirExists) fail('content/images/list missing');
  if (report.listDirImageCount < 1) fail('content/images/list has no LIST images');
  if (report.exploreSource !== 'listImages') fail(`LIST source should be listImages, got ${report.exploreSource}`);
  if (!report.textLoaded || report.textSource !== 'text/TOKYO FOOD.txt') {
    fail(`shared text not loaded: ${report.textSource} loaded=${report.textLoaded}`);
  }
  if (!report.coverDirExists || report.coverImageCount < 1) fail('content/images/cover has no images');
  if (report.foodFolderCount !== 7) fail(`food folders ${report.foodFolderCount}, expected 7`);
  if (report.categoryFoodSlideCount < 7) fail(`food slides ${report.categoryFoodSlideCount}`);
  if (report.animationVideoMode === 'missing' || report.animationVideoFiles.length === 0) {
    fail('animation mp4 not resolved');
  }

  const categories = JSON.parse(fs.readFileSync(path.join(contentRoot, 'categories.json'), 'utf8'));
  const food = categories.find((row) => row.id === 'food');
  const gallery = buildCategoryGallery(contentRoot, food);
  if (gallery.images[0]?.kind !== 'cover') fail('food gallery must start with opening cover');
  const introStem = gallery.images[0].fileName.replace(/\.[^.]+$/, '');
  if (!/^(表|hyoshi|cover-front|intro)/i.test(introStem)) {
    fail(`food must start with 表紙, got ${gallery.images[0].fileName}`);
  }

  const playlist = loadVideoPlaylist(contentRoot, 'animation');
  if (playlist.endPolicy !== 'media-ended') fail('animation must wait for media ended');
  if (!playlist.tracks.every((track) => track.found)) fail('animation tracks missing after fallback');
  const unique = [...new Set(playlist.tracks.map((track) => track.relativePath))];
  if (unique.length === 1 && playlist.tracks.length !== 4) fail('single animation file should map to 4 monitors');

  console.info(
    JSON.stringify(
      {
        listDirImageCount: report.listDirImageCount,
        listSourceMode: report.exploreSource,
        categoryFoodFolderCount: report.foodFolderCount,
        categoryFoodSlideCount: report.categoryFoodSlideCount,
        coverImageCount: report.coverImageCount,
        textLoaded: report.textLoaded,
        textSource: report.textSource,
        animationVideoMode: report.animationVideoMode,
        animationVideoFiles: report.animationVideoFiles,
        fontFileCount: report.fontFileCount,
        foodSlides: gallery.images.length,
        uniqueAnimationFiles: unique,
      },
      null,
      2,
    ),
  );
}

if (process.exitCode) {
  console.error('production phase 6 check failed');
  process.exit(process.exitCode);
}
console.info('production phase 6 check ok');
