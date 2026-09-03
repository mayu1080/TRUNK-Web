'use strict';

/**
 * Content image intake smoke check (Phase 3.5).
 * From app/ after `npm run build`: npm run check:production-content
 */
const path = require('node:path');
const {
  validateProductionContentImages,
} = require('../dist/electron/content/contentImageValidation');

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

const contentRoot = resolveContentRoot();
const report = validateProductionContentImages(contentRoot);

const summary = {
  contentRoot: report.contentRoot,
  contentRootExists: report.contentRootExists,
  imagesDirExists: report.imagesDirExists,
  listDirExists: report.listDirExists,
  categoriesPresent: report.categoriesPresent,
  contentLogoDirPresent: report.contentLogoDirPresent,
  exploreSource: report.exploreSource,
  listDirImageCount: report.listDirImageCount,
  recursiveImageCount: report.recursiveImageCount,
  sourceImageCount: report.sourceImageCount,
  supportedCount: report.supportedCount,
  legacyCount: report.legacyCount,
  unsupportedFileCount: report.unsupportedFileCount,
  duplicateIdCount: report.duplicateIdCount,
  expectedDisplayedCount: report.expectedDisplayedCount,
  targetCardCount: report.targetCardCount,
  categoryIdAssignedCount: report.categoryIdAssignedCount,
  validationWarningCount: report.validationWarningCount,
  filenameWarningCount: report.filenameWarningCount,
  sizeWarningCount: report.sizeWarningCount,
  strongSizeWarningCount: report.strongSizeWarningCount,
  fileSizeWarningCount: report.fileSizeWarningCount,
  foodDirExists: report.foodDirExists,
  foodFolderCount: report.foodFolderCount,
  foodFolderNames: report.foodFolderNames,
  categoryFoodSlideCount: report.categoryFoodSlideCount,
  coverDirExists: report.coverDirExists,
  coverImageCount: report.coverImageCount,
  textDirExists: report.textDirExists,
  textLoaded: report.textLoaded,
  textSource: report.textSource,
  animationDirExists: report.animationDirExists,
  animationVideoMode: report.animationVideoMode,
  animationVideoFiles: report.animationVideoFiles,
  adsDirExists: report.adsDirExists,
  adsVideoMode: report.adsVideoMode,
  adsVideoFiles: report.adsVideoFiles,
  fontsDirExists: report.fontsDirExists,
  fontFileCount: report.fontFileCount,
};

console.info('production content image check');
console.info(JSON.stringify(summary, null, 2));

if (report.issues.length > 0) {
  console.info('\nissues:');
  for (const issue of report.issues) {
    const loc = issue.relativePath ? ` (${issue.relativePath})` : '';
    console.info(`  [${issue.level}] ${issue.code}: ${issue.message}${loc}`);
  }
}

if (!report.contentRootExists) fail('contentRoot missing');
if (report.contentRootExists && !report.imagesDirExists) fail('content/images missing');

if (process.exitCode) {
  console.error('production content image check failed');
  process.exit(process.exitCode);
}
console.info('\nproduction content image check ok (warnings are non-fatal)');
