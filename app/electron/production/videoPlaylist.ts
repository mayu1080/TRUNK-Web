import fs from 'node:fs';
import path from 'node:path';
import { resolveContentPath } from '../content/contentRoot';
import { toContentRenderUrl } from '../content/contentProtocol';
import type { VideoTrackInfo } from '../../shared/productionState';
import { readMp4DurationMs } from './mp4Duration';

export interface VideoPlaylist {
  kind: 'ads' | 'animation';
  contentId: string;
  loop: boolean;
  skipOnTouch: boolean;
  durationMs: number;
  safetyCapMs: number;
  fatalIfMissing: boolean;
  endPolicy: 'duration' | 'media-ended';
  jsonPath: string | null;
  tracks: VideoTrackInfo[];
  warnings: string[];
}

interface RawPlaylist {
  contentId?: unknown;
  loop?: unknown;
  skipOnTouch?: unknown;
  durationMs?: unknown;
  safetyCapMs?: unknown;
  fatalIfMissing?: unknown;
  endPolicy?: unknown;
  tracks?: unknown;
}

const MONITOR_IDS = [1, 2, 3, 4] as const;

function readJsonIfPresent(filePath: string): RawPlaylist | null {
  if (!fs.existsSync(filePath)) return null;
  const text = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`${path.basename(filePath)} must be an object`);
  }
  return parsed as RawPlaylist;
}

function asPositiveMs(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback;
  return Math.round(value);
}

const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov']);

function listKindMedia(contentRoot: string, kind: 'ads' | 'animation'): string[] {
  const dir = kind === 'ads' ? 'ads' : 'animation';
  let abs: string;
  try {
    abs = resolveContentPath(contentRoot, dir);
  } catch {
    return [];
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) return [];
  try {
    return fs
      .readdirSync(abs)
      .filter((name) => {
        if (name.startsWith('.')) return false;
        const full = path.join(abs, name);
        return fs.existsSync(full) && fs.statSync(full).isFile() && VIDEO_EXTS.has(path.extname(name).toLowerCase());
      })
      .sort((a, b) => a.localeCompare(b, 'en'))
      .map((name) => `${dir}/${name}`);
  } catch {
    return [];
  }
}

function makeTrack(contentRoot: string, monitorId: number, file: string): VideoTrackInfo {
  let found = false;
  let url: string | null = null;
  try {
    const abs = resolveContentPath(contentRoot, file);
    found = fs.existsSync(abs) && fs.statSync(abs).isFile();
    if (found) url = toContentRenderUrl(file);
  } catch {
    found = false;
  }
  return { monitorId, relativePath: file, url, found };
}

/** One file → all monitors. monitor-N.mp4 → that monitor. Else sorted files by monitor index. */
function fillMissingTracks(
  contentRoot: string,
  kind: 'ads' | 'animation',
  tracks: VideoTrackInfo[],
): VideoTrackInfo[] {
  const found = tracks.filter((track) => track.found);
  const unique = [...new Set(found.map((track) => track.relativePath))];
  if (unique.length === 1 && found.length < MONITOR_IDS.length) {
    return MONITOR_IDS.map((id) => makeTrack(contentRoot, id, unique[0]!));
  }
  if (found.length > 0) return tracks;

  const files = listKindMedia(contentRoot, kind);
  if (files.length === 0) return tracks;
  if (files.length === 1) {
    return MONITOR_IDS.map((id) => makeTrack(contentRoot, id, files[0]!));
  }

  const byMonitor = new Map<number, string>();
  for (const file of files) {
    const match = path.basename(file).match(/monitor-(\d)/i);
    if (match) byMonitor.set(Number(match[1]), file);
  }
  if (byMonitor.size > 0) {
    return MONITOR_IDS.map((id) => {
      const file = byMonitor.get(id) ?? files[0]!;
      return makeTrack(contentRoot, id, file);
    });
  }
  return MONITOR_IDS.map((id, index) => makeTrack(contentRoot, id, files[index] ?? files[files.length - 1]!));
}

function conventionTracks(kind: 'ads' | 'animation'): Array<{ monitorId: number; file: string }> {
  const dir = kind === 'ads' ? 'ads' : 'animation';
  return MONITOR_IDS.map((monitorId) => ({ monitorId, file: `${dir}/monitor-${monitorId}.mp4` }));
}

function resolveTracks(
  contentRoot: string,
  rawTracks: unknown,
  kind: 'ads' | 'animation',
): VideoTrackInfo[] {
  const source = Array.isArray(rawTracks) ? rawTracks : conventionTracks(kind);
  const byId = new Map<number, VideoTrackInfo>();
  for (const item of source) {
    if (!item || typeof item !== 'object') continue;
    const row = item as { monitorId?: unknown; file?: unknown };
    const monitorId = Number(row.monitorId);
    const file = typeof row.file === 'string' ? row.file.replace(/\\/g, '/') : '';
    if (!MONITOR_IDS.includes(monitorId as (typeof MONITOR_IDS)[number]) || !file) continue;
    let found = false;
    let url: string | null = null;
    try {
      const abs = resolveContentPath(contentRoot, file);
      found = fs.existsSync(abs) && fs.statSync(abs).isFile();
      if (found) url = toContentRenderUrl(file);
    } catch {
      found = false;
    }
    byId.set(monitorId, { monitorId, relativePath: file, url, found });
  }
  return MONITOR_IDS.map((id) => {
    return (
      byId.get(id) ?? {
        monitorId: id,
        relativePath: `${kind === 'ads' ? 'ads' : 'animation'}/monitor-${id}.mp4`,
        url: null,
        found: false,
      }
    );
  });
}

export function loadVideoPlaylist(
  contentRoot: string,
  kind: 'ads' | 'animation',
): VideoPlaylist {
  const fileName = kind === 'ads' ? 'ads.json' : 'animation.json';
  const jsonPath = path.join(contentRoot, fileName);
  const raw = readJsonIfPresent(jsonPath);
  const warnings: string[] = [];
  let tracks = resolveTracks(contentRoot, raw?.tracks, kind);
  const before = tracks.filter((track) => track.found).length;
  tracks = fillMissingTracks(contentRoot, kind, tracks);
  const after = tracks.filter((track) => track.found).length;
  if (before === 0 && after > 0) {
    const files = [...new Set(tracks.filter((track) => track.found).map((track) => track.relativePath))];
    warnings.push(
      files.length === 1
        ? `${kind} json/convention paths missing; using ${files[0]} on all monitors`
        : `${kind} json/convention paths missing; assigned ${files.join(', ')}`,
    );
  }
  const missing = tracks.filter((t) => !t.found);
  if (missing.length > 0) {
    warnings.push(
      `${kind} missing ${missing.length}/4 files (${missing.map((t) => t.relativePath).join(', ')}); placeholder will be used`,
    );
  }

  let durationMs = asPositiveMs(raw?.durationMs, kind === 'ads' ? 15000 : 8000);
  let safetyCapMs = asPositiveMs(raw?.safetyCapMs, durationMs + 2000);
  let endPolicy: VideoPlaylist['endPolicy'] = 'duration';

  if (kind === 'animation') {
    const mediaMs = maxFoundTrackDurationMs(contentRoot, tracks);
    if (mediaMs != null) {
      durationMs = mediaMs;
      safetyCapMs = mediaMs + 2500;
      endPolicy = 'media-ended';
    } else if (tracks.some((t) => t.found)) {
      safetyCapMs = Math.max(safetyCapMs, durationMs + 2000, 20000);
      endPolicy = 'media-ended';
      warnings.push('animation mp4 duration could not be read; waiting for ended + 20s safety cap');
    }
  }

  const playlist: VideoPlaylist = {
    kind,
    contentId:
      typeof raw?.contentId === 'string' && raw.contentId.trim()
        ? raw.contentId.trim()
        : kind === 'ads'
          ? 'ad-wall'
          : 'animation-entry',
    loop: kind === 'ads' ? raw?.loop !== false : false,
    skipOnTouch: false,
    durationMs,
    safetyCapMs: Math.max(safetyCapMs, durationMs),
    fatalIfMissing: raw?.fatalIfMissing === true,
    endPolicy,
    jsonPath: raw ? jsonPath : null,
    tracks,
    warnings,
  };
  if (playlist.fatalIfMissing && missing.length > 0) {
    throw new Error(`${kind}: fatalIfMissing=true and files are missing`);
  }
  if (kind === 'animation' && raw?.skipOnTouch === true) {
    warnings.push('animation.skipOnTouch is true in json but production spec forbids skip; runtime will ignore touch anyway');
  }
  return playlist;
}

function maxFoundTrackDurationMs(contentRoot: string, tracks: VideoTrackInfo[]): number | null {
  let maxMs = 0;
  for (const track of tracks) {
    if (!track.found) continue;
    try {
      const abs = resolveContentPath(contentRoot, track.relativePath);
      const ms = readMp4DurationMs(abs);
      if (ms != null && ms > maxMs) maxMs = ms;
    } catch {
      /* skip unreadable track */
    }
  }
  return maxMs > 0 ? maxMs : null;
}
