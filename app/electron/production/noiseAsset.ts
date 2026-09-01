import fs from 'node:fs';
import path from 'node:path';
import { resolveContentPath } from '../content/contentRoot';
import { toContentRenderUrl } from '../content/contentProtocol';

const NOISE_DIR = 'noise';
const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov']);

export interface NoiseAsset {
  found: boolean;
  fileName: string | null;
  relativePath: string | null;
  url: string | null;
  dirPresent: boolean;
  warning: string | null;
}

function listVideoFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return entries
    .filter((name) => !name.startsWith('.'))
    .filter((name) => {
      try {
        const abs = path.join(dir, name);
        return fs.statSync(abs).isFile() && VIDEO_EXT.has(path.extname(name).toLowerCase());
      } catch {
        return false;
      }
    })
    .sort((a, b) => a.localeCompare(b, 'en'));
}

export function resolveNoiseAsset(contentRoot: string): NoiseAsset {
  const absDir = path.join(contentRoot, NOISE_DIR);
  const dirPresent = fs.existsSync(absDir) && fs.statSync(absDir).isDirectory();
  if (!dirPresent) {
    return {
      found: false,
      fileName: null,
      relativePath: null,
      url: null,
      dirPresent: false,
      warning: 'content/noise directory missing; using DOM grain fallback',
    };
  }

  const files = listVideoFiles(absDir);
  const preferred = files.find((name) => name.toLowerCase() === 'noise.mp4') ?? files[0];
  if (!preferred) {
    return {
      found: false,
      fileName: null,
      relativePath: null,
      url: null,
      dirPresent: true,
      warning: 'content/noise has no mp4/webm/mov; using DOM grain fallback',
    };
  }

  const relativePath = `${NOISE_DIR}/${preferred}`;
  resolveContentPath(contentRoot, relativePath);
  return {
    found: true,
    fileName: preferred,
    relativePath,
    url: toContentRenderUrl(relativePath),
    dirPresent: true,
    warning: null,
  };
}
