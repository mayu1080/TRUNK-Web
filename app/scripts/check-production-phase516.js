'use strict';

/**
 * Production Phase 5.16: shared text, Food cover interleave, ANIMATION mp4 mapping.
 * From app/ after `npm run build`: npm run check:production-phase516
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
  console.error('production phase 5.16 overlay independence failed');
  process.exit(process.exitCode);
}

const root = path.join(__dirname, '..', '..');
const app = path.join(__dirname, '..');
const src = path.join(app, 'renderer', 'production', 'src');
const contentRoot = process.env.TRUNK_CONTENT_ROOT?.trim()
  ? path.resolve(process.env.TRUNK_CONTENT_ROOT.trim())
  : path.join(root, 'content');

mustContain(path.join(src, 'overlays', 'CategoryModal.tsx'), [
  'category-modal__course',
  'courseName',
  '[open, shown.categoryLabel, count, loopable]',
]);
mustNotContain(path.join(src, 'overlays', 'CategoryModal.tsx'), [
  'category-modal__dots',
  'category-modal__dot',
]);
mustContain(path.join(src, 'styles.css'), [
  'white-space: pre-line',
  '.category-modal__course',
  'font-family: "Maison Neue", "Helvetica Neue", Arial, sans-serif',
]);
mustNotContain(path.join(src, 'styles.css'), [
  '.category-modal__title::before',
  '.category-modal__title::after',
  '.category-modal__dots',
  '.category-modal__dot',
]);
mustContain(path.join(src, 'imageCopy.ts'), ['sharedTitle', 'TOKYO FOOD.txt']);
mustContain(path.join(src, 'App.tsx'), [
  'getSharedCopy',
  'sharedCopy',
  "type: 'ANIMATION_COMPLETE'",
  "addEventListener('ended'",
  'lastActivityAtRef',
  'setGallery(null)',
  'setModalIndex(0)',
]);
mustNotContain(path.join(src, 'App.tsx'), [
  'own.selectedCategoryId) ?? gallery?.category',
]);
mustContain(path.join(src, 'imageCopy.ts'), ["categoryLabel: ''"]);
mustContain(path.join(app, 'electron', 'preload.ts'), ['getSharedCopy']);
mustContain(path.join(app, 'electron', 'main.ts'), ["trunk:getSharedCopy"]);
mustContain(path.join(app, 'electron', 'production', 'videoSyncController.ts'), [
  'waitForMediaEnded',
  'animation waits for media ended',
]);
mustContain(path.join(app, 'electron', 'production', 'videoPlaylist.ts'), [
  'readMp4DurationMs',
  "endPolicy = 'media-ended'",
]);
mustContain(path.join(app, 'shared', 'idleConfig.ts'), ['PRODUCTION_SHELL_IDLE_TIMEOUT_SECONDS = 120']);

const categories = JSON.parse(fs.readFileSync(path.join(contentRoot, 'categories.json'), 'utf8'));
const food = categories.find((row) => row.id === 'food');
const gift = categories.find((row) => row.id === 'gift');
const flower = categories.find((row) => row.id === 'flower');
if (!food || !Array.isArray(food.contentFolders) || food.contentFolders.length !== 7) {
  fail('food.contentFolders must list all 7 folders');
}
if (food.insertCoverBetweenFolders !== true) fail('food.insertCoverBetweenFolders must be true');
if (food.coverDir !== 'images/cover') fail('food.coverDir must be images/cover');
if (gift?.insertCoverBetweenFolders) fail('gift must not insert cover yet');
if (flower?.insertCoverBetweenFolders) fail('flower must not insert cover yet');
if (!Array.isArray(gift?.contentFolders) || gift.contentFolders.length === 0) {
  fail('gift.contentFolders must be listed for later cover insertion');
}
const expectedFood = food.contentFolders;

const animation = JSON.parse(fs.readFileSync(path.join(contentRoot, 'animation.json'), 'utf8'));
if (animation.durationMs !== 5000) fail('animation.json durationMs should be 5000');
const animFiles = (animation.tracks || []).map((row) => row.file);
if (animFiles.length !== 4 || animFiles.some((file) => file !== 'animation/LogoMotion_Trunk.mp4')) {
  fail('animation.json must map all 4 monitors to animation/LogoMotion_Trunk.mp4');
}

const txtPath = path.join(contentRoot, 'text', 'TOKYO FOOD.txt');
if (!fs.existsSync(txtPath)) fail('content/text/TOKYO FOOD.txt missing');
const txt = fs.readFileSync(txtPath, 'utf8');
const firstLine = txt.split(/\r?\n/).find((line) => line.trim());
if (!firstLine || !firstLine.includes('"TOKYO FOOD"')) {
  fail('TOKYO FOOD.txt first line should keep quoted title');
}

const distGallery = path.join(app, 'dist', 'electron', 'content', 'categoryGallery.js');
const distCopy = path.join(app, 'dist', 'electron', 'content', 'sharedCopy.js');
if (!fs.existsSync(distGallery) || !fs.existsSync(distCopy)) {
  fail('run npm run build before check:production-phase516 (dist gallery/copy missing)');
} else {
  const { buildCategoryGallery } = require(distGallery);
  const { loadSharedCopy } = require(distCopy);
  const copy = loadSharedCopy(contentRoot);
  if (!copy.found) fail(`shared copy not found: ${copy.warning}`);
  if (copy.title !== '"TOKYO FOOD"') fail(`shared title should keep quotes, got ${JSON.stringify(copy.title)}`);
  if (!copy.description.includes('フレンチ')) fail('shared description should keep body text');

  const gallery = buildCategoryGallery(contentRoot, food);
  if (gallery.images.length === 0) fail('food gallery empty');
  if (gallery.images[0].kind !== 'cover') fail('food gallery must start with cover');
  const firstStem = gallery.images[0].fileName.replace(/\.[^.]+$/, '');
  if (!/^(表|hyoshi|cover-front|intro)/i.test(firstStem)) {
    fail(`food must start with intro 表紙, got ${gallery.images[0].fileName}`);
  }
  if (gallery.images[0].courseName) fail('intro 表紙 must not show a course name');

  const coverDirAbs = path.join(contentRoot, food.coverDir);
  const coverStems = fs.existsSync(coverDirAbs)
    ? fs
        .readdirSync(coverDirAbs)
        .filter((name) => /\.(png|jpe?g|webp|gif)$/i.test(name))
        .map((name) => name.replace(/\.[^.]+$/, ''))
    : [];
  const coverStemSet = new Set(coverStems);

  let cursor = 1;
  for (const folder of expectedFood) {
    if (coverStemSet.has(folder)) {
      const coverSlide = gallery.images[cursor];
      if (!coverSlide || coverSlide.kind !== 'cover') {
        fail(`food ${folder} should start with a course cover`);
      } else {
        const coverStem = coverSlide.fileName.replace(/\.[^.]+$/, '');
        if (coverStem !== folder) fail(`food ${folder} cover is ${coverSlide.fileName}`);
        const expectedName = food.contentFolderLabels?.[folder] || folder;
        if (coverSlide.courseName !== expectedName) fail(`food ${folder} cover should show course name`);
      }
      cursor += 1;
    }
    const firstContent = gallery.images[cursor];
    const hasContent = Boolean(
      firstContent && firstContent.kind === 'content' && firstContent.contentFolder === folder,
    );
    if (!hasContent && !coverStemSet.has(folder)) {
      fail(`food ${folder} content slides missing after cover`);
    }
    while (cursor < gallery.images.length && gallery.images[cursor].contentFolder === folder) {
      cursor += 1;
    }
  }
  if (cursor !== gallery.images.length) {
    fail(`food gallery leftover slides after JSON folders (${cursor} / ${gallery.images.length})`);
  }

  const coverCount = gallery.images.filter((img) => img.kind === 'cover').length;
  const contentCount = gallery.images.filter((img) => img.kind === 'content').length;
  if (contentCount < expectedFood.length) fail('food content slides fewer than folders');
  const folderOrder = [];
  for (const img of gallery.images) {
    if (img.contentFolder && folderOrder[folderOrder.length - 1] !== img.contentFolder) {
      folderOrder.push(img.contentFolder);
    }
  }
  if (JSON.stringify(folderOrder) !== JSON.stringify(expectedFood)) {
    fail(`food folder order ${JSON.stringify(folderOrder)} !== ${JSON.stringify(expectedFood)}`);
  }
  const giftGallery = buildCategoryGallery(contentRoot, gift);
  if (giftGallery.images.some((img) => img.kind === 'cover')) fail('gift gallery must not insert cover yet');

  const { loadVideoPlaylist } = require(path.join(app, 'dist', 'electron', 'production', 'videoPlaylist.js'));
  const playlist = loadVideoPlaylist(contentRoot, 'animation');
  if (playlist.endPolicy !== 'media-ended') fail('animation with mp4 must wait for media ended, not json duration cut');
  if (!playlist.tracks.every((track) => track.found)) fail('animation tracks should resolve LogoMotion_Trunk.mp4');

  console.info(
    JSON.stringify(
      {
        foodSlides: gallery.images.length,
        coverCount,
        contentCount,
        folderOrder,
        sharedTitle: copy.title,
        animationFile: animFiles[0],
        jsonDurationMs: animation.durationMs,
        runtimeDurationMs: playlist.durationMs,
        endPolicy: playlist.endPolicy,
        safetyCapMs: playlist.safetyCapMs,
      },
      null,
      2,
    ),
  );
}

if (process.exitCode) {
  console.error('production phase 5.16 check failed');
  process.exit(process.exitCode);
}
console.info('production phase 5.16 check ok');
