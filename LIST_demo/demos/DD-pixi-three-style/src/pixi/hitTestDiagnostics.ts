import { DEMO_ID } from '../demoIdentity';
import type { Container } from 'pixi.js';
import { Point } from 'pixi.js';
import type { PlacedImage } from './exploreScene';
import {
  hitTestCandidatesDetailed,
  pickFrontCandidate,
  type HitTestCandidate,
  type HitTestFilterStats,
} from './exploreScene';

export type TapRejectedReason =
  | 'none'
  | 'disabled'
  | 'locked'
  | 'cooldown'
  | 'dragging'
  | 'moved-too-far'
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
  hitTestExecuted: boolean;
  pointerTarget: 'canvas' | 'dom' | 'unknown';
  elementsFromPoint: string[];
  domBlocksCanvas: boolean;
  filterStats: HitTestFilterStats;
  hitCandidates: HitTestCandidate[];
  hitCandidatesAtDown: HitTestCandidate[];
  chosenImageId: string | null;
  chosenRenderOrder: number | null;
  chosenAlpha: number | null;
  chosenBounds: BoundsRect | null;
  chosenAtDownImageId: string | null;
  tapMoveThresholdPx: number;
  tapMaxDurationMs: number;
  panStartThresholdPx: number;
  canvasRect: { left: number; top: number; width: number; height: number };
  rendererResolution: number;
  tapLocked: boolean;
  cooldownRemainingMs: number;
  overlayBlocking: boolean;
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
  stats: HitTestFilterStats;
} {
  const { candidates, stats } = hitTestCandidatesDetailed(images, rendererX, rendererY);
  const chosen = pickFrontCandidate(candidates);
  return {
    candidates,
    chosen,
    world: rendererToWorld(world, rendererX, rendererY),
    stats,
  };
}

export function logHitTestSnapshot(snapshot: HitTestDebugSnapshot): void {
  const lines = [
    `[${DEMO_ID} tapCheck]`,
    `down: client(${snapshot.clientDown.x.toFixed(0)},${snapshot.clientDown.y.toFixed(0)}) canvas(${snapshot.canvasDown.x.toFixed(1)},${snapshot.canvasDown.y.toFixed(1)})`,
    `up: client(${snapshot.clientUp.x.toFixed(0)},${snapshot.clientUp.y.toFixed(0)}) canvas(${snapshot.canvasUp.x.toFixed(1)},${snapshot.canvasUp.y.toFixed(1)})`,
    `moveDistance: ${snapshot.moveDistancePx.toFixed(1)}  durationMs: ${snapshot.durationMs.toFixed(0)}`,
    `rejectedReason: ${snapshot.tapRejectedReason}  hitTestExecuted: ${snapshot.hitTestExecuted}`,
    `pointer client: ${snapshot.clientUp.x.toFixed(0)}, ${snapshot.clientUp.y.toFixed(0)}`,
    `canvas rect: ${snapshot.canvasRect.left.toFixed(0)}, ${snapshot.canvasRect.top.toFixed(0)}, ${snapshot.canvasRect.width.toFixed(0)}x${snapshot.canvasRect.height.toFixed(0)}`,
    `pointer local/canvas: ${snapshot.canvasUp.x.toFixed(1)}, ${snapshot.canvasUp.y.toFixed(1)}`,
    `renderer resolution: ${snapshot.rendererResolution}`,
    `filter: before=${snapshot.filterStats.beforeFilter} vis=${snapshot.filterStats.afterVisibility} alpha=${snapshot.filterStats.afterAlpha} final=${snapshot.filterStats.final}`,
    `domBlocks: ${snapshot.domBlocksCanvas}  overlayBlocking: ${snapshot.overlayBlocking}  tapLocked: ${snapshot.tapLocked}  cooldownRem: ${snapshot.cooldownRemainingMs.toFixed(0)}`,
    `hit candidates: ${snapshot.hitCandidates.length}`,
  ];

  for (const [i, c] of snapshot.hitCandidates.slice(0, 6).entries()) {
    lines.push(
      `  ${i + 1}. ${c.imageId} order=${c.renderOrder} α=${c.alpha.toFixed(2)} bounds=${formatBounds(c.bounds)}`,
    );
  }

  if (snapshot.chosenImageId) {
    lines.push(
      `chosen: ${snapshot.chosenImageId} order=${snapshot.chosenRenderOrder} α=${snapshot.chosenAlpha?.toFixed(2) ?? '—'}`,
    );
    if (snapshot.chosenBounds) {
      lines.push(`chosen bounds: ${formatBounds(snapshot.chosenBounds)}`);
    }
  } else if (snapshot.wasTap || snapshot.hitTestExecuted) {
    lines.push('chosen: (none)');
  }

  console.log(lines.join('\n'));
}

function formatBounds(b: BoundsRect): string {
  return `x=${b.x.toFixed(0)} y=${b.y.toFixed(0)} w=${b.w.toFixed(0)} h=${b.h.toFixed(0)}`;
}
