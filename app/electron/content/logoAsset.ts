import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { resolveContentPath } from './contentRoot';
import { toContentRenderUrl, toLogoRenderUrl } from './contentProtocol';

export interface LogoAsset {
  found: boolean;
  fileName: string | null;
  url: string | null;
  logoRoot: string;
}

/** Same layout as content/: repo-root Logo/ when cwd is app/. */
export function resolveLogoRoot(): string {
  if (app.isPackaged) {
    return path.join(path.dirname(process.execPath), 'Logo');
  }
  return path.resolve(process.cwd(), '..', 'Logo');
}

const EXT_PRIORITY = ['.png', '.svg', '.jpg', '.jpeg'] as const;

function rankExt(ext: string): number {
  const i = EXT_PRIORITY.indexOf(ext as (typeof EXT_PRIORITY)[number]);
  return i === -1 ? 99 : i;
}

export function pickLogoFileName(logoRoot: string): string | null {
  if (!fs.existsSync(logoRoot) || !fs.statSync(logoRoot).isDirectory()) return null;
  let entries: string[];
  try {
    entries = fs.readdirSync(logoRoot);
  } catch {
    return null;
  }

  const candidates = entries
    .filter((name) => !name.startsWith('.'))
    .map((name) => {
      try {
        const stat = fs.statSync(path.join(logoRoot, name));
        if (!stat.isFile()) return null;
      } catch {
        return null;
      }
      const textRank = /^logo_text\./i.test(name) ? 0 : 1;
      return { name, rank: rankExt(path.extname(name).toLowerCase()), textRank };
    })
    .filter((item): item is { name: string; rank: number; textRank: number } => item != null && item.rank < 99)
    .sort((a, b) => a.textRank - b.textRank || a.rank - b.rank || a.name.localeCompare(b.name, 'en'));

  return candidates[0]?.name ?? null;
}

export function resolveLogoAsset(options?: { contentRoot?: string }): LogoAsset {
  if (options?.contentRoot) {
    const contentLogoRoot = path.join(options.contentRoot, 'Logo');
    const contentFile = pickLogoFileName(contentLogoRoot);
    if (contentFile) {
      resolveContentPath(contentLogoRoot, contentFile);
      return {
        found: true,
        fileName: contentFile,
        url: toContentRenderUrl(`Logo/${contentFile}`),
        logoRoot: contentLogoRoot,
      };
    }
  }

  const logoRoot = resolveLogoRoot();
  const fileName = pickLogoFileName(logoRoot);
  if (!fileName) {
    return { found: false, fileName: null, url: null, logoRoot };
  }
  resolveContentPath(logoRoot, fileName);
  return {
    found: true,
    fileName,
    url: toLogoRenderUrl(fileName),
    logoRoot,
  };
}
