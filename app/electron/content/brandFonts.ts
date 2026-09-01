import type { BrandFontCatalog, BrandFontFace } from '../../shared/types';
import fs from 'node:fs';
import path from 'node:path';
import { getContentService } from './contentService';
import { toContentRenderUrl } from './contentProtocol';

const FAMILY = 'Maison Neue';
const RELATIVE_DIR = 'fonts/MaisonNeue';

function inferWeightAndStyle(fileName: string): { weight: number; style: 'normal' | 'italic'; guessed: boolean } | null {
  if (!/^maisonneue[-_]/i.test(fileName) || !/\.otf$/i.test(fileName)) return null;
  if (/mono/i.test(fileName)) return null;

  const stem = fileName.replace(/\.otf$/i, '');
  const italic = /italic/i.test(stem);
  const guessed = !/(light|book|regular|medium|demi|semi|bold)/i.test(stem);
  let weight = 400;
  if (/light/i.test(stem)) weight = 300;
  else if (/book|regular/i.test(stem)) weight = 400;
  else if (/medium/i.test(stem)) weight = 500;
  else if (/demi|semi/i.test(stem)) weight = 600;
  else if (/bold/i.test(stem)) weight = 700;

  return { weight, style: italic ? 'italic' : 'normal', guessed };
}

export function getBrandFonts(): BrandFontCatalog {
  const { contentRoot } = getContentService();
  const absDir = path.join(contentRoot, ...RELATIVE_DIR.split('/'));
  if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) {
    return {
      family: FAMILY,
      format: 'otf',
      dirPresent: false,
      faces: [],
      skipped: [],
      warning: 'Maison Neue missing / fallback (fonts/MaisonNeue not found)',
    };
  }

  let names: string[] = [];
  try {
    names = fs.readdirSync(absDir);
  } catch {
    return {
      family: FAMILY,
      format: 'otf',
      dirPresent: true,
      faces: [],
      skipped: [],
      warning: 'Maison Neue missing / fallback (could not read fonts/MaisonNeue)',
    };
  }

  const faces: BrandFontFace[] = [];
  const skipped: string[] = [];
  for (const fileName of names) {
    if (fileName.startsWith('.')) continue;
    const inferred = inferWeightAndStyle(fileName);
    if (!inferred) {
      if (/\.otf$/i.test(fileName)) skipped.push(fileName);
      continue;
    }
    const relativePath = `${RELATIVE_DIR}/${fileName}`;
    faces.push({
      family: FAMILY,
      fileName,
      relativePath,
      url: toContentRenderUrl(relativePath),
      weight: inferred.weight,
      style: inferred.style,
      format: 'otf',
      guessed: inferred.guessed,
    });
  }

  faces.sort((a, b) => a.weight - b.weight || a.style.localeCompare(b.style) || a.fileName.localeCompare(b.fileName));

  return {
    family: FAMILY,
    format: 'otf',
    dirPresent: true,
    faces,
    skipped,
    warning: faces.length === 0 ? 'Maison Neue missing / fallback (no MaisonNeue-*.otf)' : null,
  };
}
