import type { Container } from 'pixi.js';
import { Point } from 'pixi.js';
import type { PlacedImage } from './exploreScene';
import { hitTestCandidates, pickFrontCandidate, type HitTestCandidate } from './exploreScene';

export type TapRejectedReason =
  | 'none'
  | 'disabled'
  | 'locked'
  | 'cooldown'
  | 'dragging'
  | 'duration'
  | 'multiPointer'
  | 'noCandidate'
  | 'blocked'
  | 'error';

export interface BoundsRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HitTestDebugSnapshot {
  timestamp: number;
  clientDown: { x: number; y: number };
  clientUp: { x: number; y: number };
  canvasDown: { x: number; y: number };
  canvasUp: { x: number; y: number };
  worldDown: { x: number; y: number };
  worldUp: { x: number; y: number };
  moveDistancePx: number;
  durationMs: number;
  wasDragging: boolean;
  wasTap: boolean;
  tapRejectedReason: TapRejectedReason;
  pointerTarget: 'canvas' | 'dom' | 'unknown';
  elementsFromPoint: string[];
  domBlocksCanvas: boolean;
  hitCandidates: HitTestCandidate[];
  hitCandidatesAtDown: HitTestCandidate[];
  chosenImageId: string | null;
  chosenBounds: BoundsRect | null;
  chosenAtDownImageId: string | null;
  tapMoveThresholdPx: number;
  tapMaxDurationMs: number;
  panStartThresholdPx: number;
}

const _worldPoint = new Point();

export function rendererToWorld(
  world: Container,
  rendererX: number,
  rendererY: number,
): { x: number; y: number } {
  world.toLocal({ x: rendererX, y: rendererY }, undefined, _worldPoint);
  return { x: _worldPoint.x, y: _worldPoint.y };
}

export function boundsToRect(bounds: {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}): BoundsRect {
  return {
    x: bounds.minX,
    y: bounds.minY,
    w: bounds.maxX - bounds.minX,
    h: bounds.maxY - bounds.minY,
  };
}

export function probeDomAtPoint(clientX: number, clientY: number): {
  elements: string[];
  pointerTarget: 'canvas' | 'dom' | 'unknown';
  domBlocksCanvas: boolean;
} {
  const elements = document.elementsFromPoint(clientX, clientY);
  const labels = elements.slice(0, 8).map(describeElement);
  const canvasIndex = elements.findIndex((el) => el instanceof HTMLCanvasElement);
  const top = elements[0];
  const pointerTarget: 'canvas' | 'dom' | 'unknown' =
    top instanceof HTMLCanvasElement
      ? 'canvas'
      : top
        ? 'dom'
        : 'unknown';
  const domBlocksCanvas =
    canvasIndex > 0 &&
    elements.slice(0, canvasIndex).some((el) => {
      const style = window.getComputedStyle(el);
      return style.pointerEvents !== 'none';
    });

  return { elements: labels, pointerTarget, domBlocksCanvas };
}

function describeElement(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const cls =
    el.classList.length > 0
      ? `.${[...el.classList].slice(0, 2).join('.')}`
      : '';
  const pe = window.getComputedStyle(el).pointerEvents;
  const peNote = pe !== 'auto' ? ` [pe:${pe}]` : '';
  return `${tag}${id}${cls}${peNote}`;
}

export function runHitTestAt(
  world: Container,
  images: PlacedImage[],
  rendererX: number,
  rendererY: number,
): {
  candidates: HitTestCandidate[];
  chosen: HitTestCandidate | null;
  world: { x: number; y: number };
} {
  const candidates = hitTestCandidates(images, rendererX, rendererY);
  const chosen = pickFrontCandidate(candidates);
  return {
    candidates,
    chosen,
    world: rendererToWorld(world, rendererX, rendererY),
  };
}

export function logHitTestSnapshot(snapshot: HitTestDebugSnapshot): void {
  const lines = [
    '[DD hit test]',
    `pointer: client down (${snapshot.clientDown.x.toFixed(0)}, ${snapshot.clientDown.y.toFixed(0)}) → up (${snapshot.clientUp.x.toFixed(0)}, ${snapshot.clientUp.y.toFixed(0)})`,
    `canvas: down (${snapshot.canvasDown.x.toFixed(1)}, ${snapshot.canvasDown.y.toFixed(1)}) → up (${snapshot.canvasUp.x.toFixed(1)}, ${snapshot.canvasUp.y.toFixed(1)})`,
    `world: down (${snapshot.worldDown.x.toFixed(1)}, ${snapshot.worldDown.y.toFixed(1)}) → up (${snapshot.worldUp.x.toFixed(1)}, ${snapshot.worldUp.y.toFixed(1)})`,
    `moveDistance: ${snapshot.moveDistancePx.toFixed(1)}px  duration: ${snapshot.durationMs.toFixed(0)}ms`,
    `wasTap: ${snapshot.wasTap}  wasDragging: ${snapshot.wasDragging}  rejected: ${snapshot.tapRejectedReason}`,
    `thresholds: tapMove<=${snapshot.tapMoveThresholdPx}px  tapDur<=${snapshot.tapMaxDurationMs}ms  panStart>=${snapshot.panStartThresholdPx}px`,
    `pointer target: ${snapshot.pointerTarget}  domBlocksCanvas: ${snapshot.domBlocksCanvas}`,
    `elementsFromPoint: ${snapshot.elementsFromPoint.join(' → ')}`,
    `hit candidates (at up): ${snapshot.hitCandidates.length}`,
  ];

  for (const [i, c] of snapshot.hitCandidates.entries()) {
    lines.push(
      `  ${i + 1}. ${c.imageId} depth=${c.depth.toFixed(2)} layer=${c.layerId} z=${c.zIndex} order=${c.renderOrder} bounds=${formatBounds(c.bounds)}`,
    );
  }

  if (snapshot.chosenImageId) {
    lines.push(`selected by hit test: ${snapshot.chosenImageId}`);
    if (snapshot.chosenBounds) {
      lines.push(`chosen bounds: ${formatBounds(snapshot.chosenBounds)}`);
    }
  } else if (snapshot.wasTap) {
    lines.push('selected by hit test: (none)');
  }

  if (
    snapshot.chosenAtDownImageId &&
    snapshot.chosenAtDownImageId !== snapshot.chosenImageId
  ) {
    lines.push(
      `note: down-position would select ${snapshot.chosenAtDownImageId} (differs from up)`,
    );
  }

  console.log(lines.join('\n'));
}

function formatBounds(b: BoundsRect): string {
  return `x=${b.x.toFixed(0)} y=${b.y.toFixed(0)} w=${b.w.toFixed(0)} h=${b.h.toFixed(0)}`;
}
