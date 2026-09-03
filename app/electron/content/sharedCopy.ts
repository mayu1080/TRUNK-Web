import fs from 'node:fs';
import type { SharedCopy } from '../../shared/types';
import { resolveContentPath } from './contentRoot';

export const SHARED_COPY_RELATIVE_PATH = 'text/TOKYO FOOD.txt';

function parsePlainCopy(text: string): { title: string; description: string } {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const first = lines.findIndex((line) => line.trim() !== '');
  if (first < 0) {
    return { title: '', description: '' };
  }
  const title = lines[first] ?? '';
  const description = lines.slice(first + 1).join('\n').trim();
  return { title, description };
}

export function loadSharedCopy(contentRoot: string): SharedCopy {
  const relativePath = SHARED_COPY_RELATIVE_PATH;
  try {
    const abs = resolveContentPath(contentRoot, relativePath);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      return {
        found: false,
        relativePath,
        title: '',
        description: '',
        warning: `${relativePath} is missing`,
      };
    }
    const parsed = parsePlainCopy(fs.readFileSync(abs, 'utf8'));
    if (!parsed.title && !parsed.description) {
      return {
        found: false,
        relativePath,
        title: '',
        description: '',
        warning: `${relativePath} is empty`,
      };
    }
    return {
      found: true,
      relativePath,
      title: parsed.title,
      description: parsed.description,
      warning: null,
    };
  } catch (err) {
    return {
      found: false,
      relativePath,
      title: '',
      description: '',
      warning: `${relativePath}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
