import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { app } from 'electron';
import { formatContentError } from './errors';

/**
 * Resolve external content root.
 * - TRUNK_CONTENT_ROOT env overrides all
 * - dev: repo root ./content (relative to cwd when launching from repo)
 * - packaged: {execDir}/content
 */
export function resolveContentRoot(): string {
  const override = process.env.TRUNK_CONTENT_ROOT;
  if (override && override.trim()) {
    return path.resolve(override.trim());
  }

  if (app.isPackaged) {
    return path.join(path.dirname(process.execPath), 'content');
  }

  // Development: repo root is parent of app/
  return path.resolve(process.cwd(), '..', 'content');
}

export function assertContentRootExists(contentRoot: string): void {
  if (!fs.existsSync(contentRoot) || !fs.statSync(contentRoot).isDirectory()) {
    throw formatContentError('CONTENT_ROOT_MISSING', contentRoot);
  }
}

export function toRelativePath(contentRoot: string, absolutePath: string): string {
  return path.relative(contentRoot, absolutePath).split(path.sep).join('/');
}

export function resolveContentPath(contentRoot: string, relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/');
  const root = path.resolve(contentRoot);
  const resolved = path.resolve(contentRoot, normalized);
  const rel = path.relative(root, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Invalid content path: ${relativePath}`);
  }
  return resolved;
}

export function toFileUrl(contentRoot: string, relativePath: string): string {
  const absolute = resolveContentPath(contentRoot, relativePath);
  return pathToFileURL(absolute).href;
}
