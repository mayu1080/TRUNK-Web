import type { ExploreView } from './types';
import type { VisualConfig } from '../visualConfig';

export interface ContentBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function computeContentBounds(
  points: { x: number; y: number; halfW: number; halfH: number }[],
  padding = 80,
): ContentBounds {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x - p.halfW);
    minY = Math.min(minY, p.y - p.halfH);
    maxX = Math.max(maxX, p.x + p.halfW);
    maxY = Math.max(maxY, p.y + p.halfH);
  }
  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
  };
}

/** パン可能なワールド矩形（探索フィールドの端） */
export function getWorldPanBounds(world: VisualConfig['world']): ContentBounds {
  return {
    minX: 0,
    minY: 0,
    maxX: world.width,
    maxY: world.height,
  };
}

export function mergeBounds(a: ContentBounds, b: ContentBounds): ContentBounds {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

/**
 * pan/zoom をコンテンツ＋ワールド端の内側に収める。
 * world.position = pan, world.scale = zoom（renderer 座標系）
 */
export function clampExploreView(
  view: ExploreView,
  screenW: number,
  screenH: number,
  content: ContentBounds,
  world: VisualConfig['world'],
): ExploreView {
  const pad = world.panPaddingScreen;
  const zoom = view.zoom;
  const bounds = mergeBounds(content, getWorldPanBounds(world));

  const contentW = (bounds.maxX - bounds.minX) * zoom;
  const contentH = (bounds.maxY - bounds.minY) * zoom;

  let minPanX: number;
  let maxPanX: number;
  let minPanY: number;
  let maxPanY: number;

  if (contentW + pad * 2 <= screenW) {
    const cx = (bounds.minX + bounds.maxX) / 2;
    const target = screenW / 2 - cx * zoom;
    minPanX = target;
    maxPanX = target;
  } else {
    maxPanX = pad - bounds.minX * zoom;
    minPanX = screenW - pad - bounds.maxX * zoom;
  }

  if (contentH + pad * 2 <= screenH) {
    const cy = (bounds.minY + bounds.maxY) / 2;
    const target = screenH / 2 - cy * zoom;
    minPanY = target;
    maxPanY = target;
  } else {
    maxPanY = pad - bounds.minY * zoom;
    minPanY = screenH - pad - bounds.maxY * zoom;
  }

  return {
    zoom,
    panX: Math.min(maxPanX, Math.max(minPanX, view.panX)),
    panY: Math.min(maxPanY, Math.max(minPanY, view.panY)),
  };
}

/** 初期表示を写真群の重心に合わせる */
export function centerViewOnContent(
  screenW: number,
  screenH: number,
  view: ExploreView,
  content: ContentBounds,
): ExploreView {
  const cx = (content.minX + content.maxX) / 2;
  const cy = (content.minY + content.maxY) / 2;
  return {
    zoom: view.zoom,
    panX: screenW / 2 - cx * view.zoom,
    panY: screenH / 2 - cy * view.zoom,
  };
}
