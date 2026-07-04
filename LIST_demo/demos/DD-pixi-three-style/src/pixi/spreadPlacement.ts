import type { DemoListImage } from './types';
import type { VisualConfig } from '../visualConfig';
import { seededRandom } from './imageSizing';

/** 配置グループ（例: food/山吹, flower/NATURE） */
export function getPlacementGroup(meta: DemoListImage): string {
  const parts = meta.id.replace(/__dup\d+$/, '').split('/');
  if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
  return meta.categoryId ?? meta.sourceFolder ?? parts[0] ?? meta.id;
}

export interface PlacementBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface PlacedPoint {
  x: number;
  y: number;
  group: string;
}

const MAX_ATTEMPTS = 64;

/** グループを交互に並べ、同カテゴリが連続配置されないようにする */
export function interleaveByGroup(images: DemoListImage[], seed: number): DemoListImage[] {
  const rand = seededRandom(seed);
  const buckets = new Map<string, DemoListImage[]>();

  for (const img of images) {
    const g = getPlacementGroup(img);
    const list = buckets.get(g) ?? [];
    list.push(img);
    buckets.set(g, list);
  }

  const groups = [...buckets.keys()].sort();
  for (const g of groups) {
    const arr = buckets.get(g)!;
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
  }

  const result: DemoListImage[] = [];
  const queueMap = new Map(groups.map((g) => [g, [...buckets.get(g)!]]));
  let remaining = images.length;

  while (remaining > 0) {
    const order = [...groups].sort(() => rand() - 0.5);
    let progressed = false;
    for (const g of order) {
      const q = queueMap.get(g)!;
      if (q.length === 0) continue;
      result.push(q.shift()!);
      remaining -= 1;
      progressed = true;
    }
    if (!progressed) break;
  }

  return result;
}

/**
 * CULTISH 風フィールド配置 — ワールド全域にセル分割＋ジッターで散らす（円環クラスタ回避）
 */
export function findSpreadPosition(
  itemIndex: number,
  totalCount: number,
  group: string,
  _groupIndex: number,
  _groupCount: number,
  bounds: PlacementBounds,
  placed: PlacedPoint[],
  placement: VisualConfig['placement'],
  rand: () => number,
): { x: number; y: number } {
  const inset = placement.boundsInset ?? 0;
  const inner = shrinkBounds(bounds, inset);
  const spanX = inner.maxX - inner.minX;
  const spanY = inner.maxY - inner.minY;

  if (spanX <= 0 || spanY <= 0) {
    return { x: (inner.minX + inner.maxX) / 2, y: (inner.minY + inner.maxY) / 2 };
  }

  const aspect = spanX / Math.max(spanY, 1);
  const cols = Math.max(1, Math.round(Math.sqrt(totalCount * aspect)));
  const rows = Math.max(1, Math.ceil(totalCount / cols));
  const col = itemIndex % cols;
  const row = Math.floor(itemIndex / cols) % rows;
  const cellW = spanX / cols;
  const cellH = spanY / rows;
  const jitter = Math.min(0.92, Math.max(0.55, placement.fieldJitter ?? 0.8));

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const padX = cellW * (1 - jitter) * 0.5;
    const padY = cellH * (1 - jitter) * 0.5;
    const usableW = Math.max(cellW - padX * 2, 1);
    const usableH = Math.max(cellH - padY * 2, 1);
    const nudge = attempt * 4;
    const x =
      inner.minX +
      col * cellW +
      padX +
      rand() * usableW +
      (rand() - 0.5) * nudge;
    const y =
      inner.minY +
      row * cellH +
      padY +
      rand() * usableH +
      (rand() - 0.5) * nudge;

    const clampedX = Math.min(inner.maxX, Math.max(inner.minX, x));
    const clampedY = Math.min(inner.maxY, Math.max(inner.minY, y));

    if (isFarEnough(group, clampedX, clampedY, placed, placement)) {
      return { x: clampedX, y: clampedY };
    }
  }

  return {
    x: inner.minX + rand() * Math.max(spanX, 0),
    y: inner.minY + rand() * Math.max(spanY, 0),
  };
}

function shrinkBounds(bounds: PlacementBounds, inset: number): PlacementBounds {
  if (inset <= 0) return bounds;
  const spanX = bounds.maxX - bounds.minX;
  const spanY = bounds.maxY - bounds.minY;
  const dx = spanX * inset;
  const dy = spanY * inset;
  return {
    minX: bounds.minX + dx,
    maxX: bounds.maxX - dx,
    minY: bounds.minY + dy,
    maxY: bounds.maxY - dy,
  };
}

function isFarEnough(
  group: string,
  x: number,
  y: number,
  placed: PlacedPoint[],
  placement: VisualConfig['placement'],
): boolean {
  for (const p of placed) {
    const dist = Math.hypot(x - p.x, y - p.y);
    const minDist = p.group === group ? placement.sameGroupMinDist : placement.anyMinDist;
    if (dist < minDist) return false;
  }
  return true;
}

export function makePlacementBounds(
  halfW: number,
  halfH: number,
  world: VisualConfig['world'],
): PlacementBounds {
  return {
    minX: world.margin + halfW,
    maxX: world.width - world.margin - halfW,
    minY: world.margin + halfH,
    maxY: world.height - world.margin - halfH,
  };
}

/** グループ ID → 扇形インデックス */
export function buildGroupIndexMap(images: DemoListImage[]): Map<string, number> {
  const groups = [...new Set(images.map(getPlacementGroup))].sort();
  const map = new Map<string, number>();
  groups.forEach((g, i) => map.set(g, i));
  return map;
}
