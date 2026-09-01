import fs from 'node:fs';
import path from 'node:path';
import type { Category, Manifest, Product } from '../../shared/types';
import { formatContentError } from './errors';
import { resolveContentPath } from './contentRoot';

function readJsonFile<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    throw formatContentError('MANIFEST_MISSING', filePath);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch (e) {
    throw formatContentError('MANIFEST_INVALID', `${filePath} (${String(e)})`);
  }
}

function assertManifest(manifest: Manifest): void {
  const required: (keyof Manifest)[] = [
    'version',
    'updatedAt',
    'categoriesFile',
    'productsFile',
    'assetBaseDir',
    'defaultListImageDir',
  ];
  for (const key of required) {
    if (manifest[key] === undefined || manifest[key] === '') {
      throw formatContentError('MANIFEST_INVALID', `missing field: ${key}`);
    }
  }
}

function assertCategories(categories: unknown): asserts categories is Category[] {
  if (!Array.isArray(categories) || categories.length === 0) {
    throw formatContentError('CATEGORIES_INVALID', 'must be a non-empty array');
  }
  for (const raw of categories) {
    const c = raw as Category;
    if (!c.id || !c.label || !c.imageDir || typeof c.order !== 'number') {
      throw formatContentError('CATEGORIES_INVALID', `invalid entry: ${JSON.stringify(c)}`);
    }
    if (c.contentFolders !== undefined) {
      if (!Array.isArray(c.contentFolders) || c.contentFolders.some((name) => typeof name !== 'string')) {
        throw formatContentError('CATEGORIES_INVALID', `${c.id}: contentFolders must be an array of strings`);
      }
    }
    if (c.contentFolderLabels !== undefined) {
      if (
        !c.contentFolderLabels ||
        typeof c.contentFolderLabels !== 'object' ||
        Array.isArray(c.contentFolderLabels) ||
        Object.values(c.contentFolderLabels).some((value) => typeof value !== 'string')
      ) {
        throw formatContentError('CATEGORIES_INVALID', `${c.id}: contentFolderLabels must be a string map`);
      }
    }
  }
}

function assertProducts(products: unknown): asserts products is Product[] {
  if (!Array.isArray(products)) {
    throw formatContentError('PRODUCTS_INVALID', 'must be an array');
  }
  for (const p of products) {
    if (!p.id || !p.categoryId || !p.title || !Array.isArray(p.images) || p.images.length === 0) {
      throw formatContentError('PRODUCTS_INVALID', `invalid entry: ${JSON.stringify(p)}`);
    }
  }
}

export interface LoadedContent {
  manifest: Manifest;
  categories: Category[];
  products: Product[];
}

export function loadContentBundle(contentRoot: string): LoadedContent {
  const manifestPath = path.join(contentRoot, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw formatContentError('MANIFEST_MISSING', manifestPath);
  }

  const manifest = readJsonFile<Manifest>(manifestPath);
  assertManifest(manifest);

  const categoriesPath = resolveContentPath(contentRoot, manifest.categoriesFile);
  const productsPath = resolveContentPath(contentRoot, manifest.productsFile);

  const categories = readJsonFile<unknown>(categoriesPath);
  assertCategories(categories);

  const products = readJsonFile<unknown>(productsPath);
  assertProducts(products);

  return { manifest, categories, products };
}

export function validateReferencedFiles(
  contentRoot: string,
  manifest: Manifest,
  categories: Category[],
  products: Product[],
): string[] {
  const warnings: string[] = [];
  const check = (relativePath: string) => {
    const abs = resolveContentPath(contentRoot, relativePath);
    if (!fs.existsSync(abs)) {
      throw formatContentError('FILE_MISSING', relativePath);
    }
  };

  for (const category of categories) {
    const dir = resolveContentPath(contentRoot, category.imageDir);
    if (!fs.existsSync(dir)) {
      throw formatContentError('FILE_MISSING', category.imageDir);
    }
  }

  for (const product of products) {
    for (const img of product.images) {
      check(img);
    }
    if (product.thumbnail) {
      check(product.thumbnail);
    }
  }

  const listDir = resolveContentPath(contentRoot, manifest.defaultListImageDir);
  if (!fs.existsSync(listDir)) {
    throw formatContentError('FILE_MISSING', manifest.defaultListImageDir);
  }

  const listFiles = fs.readdirSync(listDir).filter((f) => !f.startsWith('.'));
  if (listFiles.length < 40) {
    warnings.push(
      `PRODUCT_LIST 用画像が ${listFiles.length} 枚です（推奨 40〜70 枚）。利用可能な画像のみ assetIndex に登録します。`,
    );
  }

  return warnings;
}
