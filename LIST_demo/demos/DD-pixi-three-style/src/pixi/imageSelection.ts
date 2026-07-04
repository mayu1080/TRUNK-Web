import {
  MAX_IMAGE_COUNT,
  TARGET_IMAGE_COUNT,
} from './constants';
import type { DemoAssetIndex, DemoListImage } from './types';

/** URL ?seed=42 で選定シードを上書き */
export function getSelectionSeed(): number {
  const param = new URLSearchParams(window.location.search).get('seed');
  if (param !== null && param !== '') {
    const n = Number(param);
    if (!Number.isNaN(n)) return Math.floor(n) % 2147483647 || 1;
  }
  return 42;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  const rand = seededRandom(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function expandToTarget(entries: DemoListImage[], target: number): DemoListImage[] {
  if (entries.length === 0) return [];
  const result: DemoListImage[] = [];
  for (let i = 0; i < target; i++) {
    const src = entries[i % entries.length]!;
    result.push({
      ...src,
      id: `${src.id}__dup${String(i + 1).padStart(3, '0')}`,
      duplicated: i >= entries.length,
    });
  }
  return result;
}

export interface SelectionResult {
  images: DemoListImage[];
  warnings: string[];
  realImageCount: number;
  displayedImageCount: number;
  duplicatedCount: number;
  selectionSeed: number;
}

/**
 * demo-asset-index の全画像から表示用配列を組み立てる。
 * - 70+ : ランダム70枚（seed 指定可）
 * - 40-69 : 全件
 * - 1-39 : 40枚に複製
 */
export function selectImagesForDisplay(
  index: DemoAssetIndex,
  seed = getSelectionSeed(),
): SelectionResult {
  const warnings = [...index.warnings];
  const real = index.images.map((img) => ({ ...img, duplicated: false }));
  const realImageCount = real.length;

  if (realImageCount === 0) {
    return {
      images: [],
      warnings,
      realImageCount: 0,
      displayedImageCount: 0,
      duplicatedCount: 0,
      selectionSeed: seed,
    };
  }

  let selected: DemoListImage[];

  if (realImageCount > MAX_IMAGE_COUNT) {
    selected = seededShuffle(real, seed).slice(0, MAX_IMAGE_COUNT);
    warnings.push(
      `実画像 ${realImageCount} 枚のうち、seed=${seed} でランダムに ${MAX_IMAGE_COUNT} 枚を選定しました。`,
    );
  } else if (realImageCount >= TARGET_IMAGE_COUNT) {
    selected = real;
  } else {
    selected = expandToTarget(real, TARGET_IMAGE_COUNT);
    warnings.push(
      `実画像が ${realImageCount} 枚のため、${TARGET_IMAGE_COUNT} 枚に複製して負荷検証しています。`,
    );
  }

  const duplicatedCount = selected.filter((i) => i.duplicated).length;

  return {
    images: selected,
    warnings,
    realImageCount,
    displayedImageCount: selected.length,
    duplicatedCount,
    selectionSeed: seed,
  };
}
