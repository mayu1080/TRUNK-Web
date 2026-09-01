import { mapCanvasCenterToRenderer, mapClientDeltaToRenderer, mapClientToRenderer } from './pointerCoords';
import type { ExploreView } from './types';
import {
  applyDepthFlowWheelFromEvent,
  clearDepthFlowWheelBoost,
} from './depthFlowSpeed';
import {
  applySceneTimeWheel,
  clearSceneTimeWheelBoost,
  isCameraNavigationMode,
  isObjectFlowMode,
} from './cameraDepth';
import {
  INERTIA_FRICTION,
  INERTIA_MIN_VELOCITY,
  MAX_ZOOM,
  MIN_ZOOM,
  PAN_START_THRESHOLD_PX,
  TAP_MAX_DURATION_MS,
  TAP_MOVE_THRESHOLD_PX,
} from './constants';

export interface TapGestureProbe {
  clientDownX: number;
  clientDownY: number;
  clientUpX: number;
  clientUpY: number;
  canvasDownX: number;
  canvasDownY: number;
  canvasUpX: number;
  canvasUpY: number;
  moveDistancePx: number;
  durationMs: number;
  wasDragging: boolean;
  wasTap: boolean;
  tapRejectedReason:
    | 'none'
    | 'disabled'
    | 'dragging'
    | 'moved-too-far'
    | 'duration'
    | 'multiPointer';
  tapMoveThresholdPx: number;
  tapMaxDurationMs: number;
  panStartThresholdPx: number;
}

export interface GestureCallbacks {
  onViewChange(view: ExploreView): void;
  /** renderer 座標（Pixi screen 空間） */
  onTap(rendererX: number, rendererY: number, probe: TapGestureProbe): void;
  onPointerDown?(clientX: number, clientY: number): void;
  onPointerMove?(clientX: number, clientY: number, dragging: boolean): void;
  onPointerUp?(): void;
  /** pointerup 時のタップ判定結果（診断用） */
  onTapProbe?(probe: TapGestureProbe): void;
}

interface PointerRecord {
  id: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startTime: number;
  didPan: boolean;
}

export class GestureController {
  private canvas: HTMLCanvasElement;
  private callbacks: GestureCallbacks;
  private view: ExploreView;
  private pointers = new Map<number, PointerRecord>();
  private enabled = true;

  private pinchStartDistance = 0;
  private pinchStartZoom = 1;

  private velocityX = 0;
  private velocityY = 0;
  private inertiaRaf: number | null = null;
  private lastMoveTime = 0;
  private viewClamp: ((view: ExploreView) => ExploreView) | null = null;

  constructor(canvas: HTMLCanvasElement, initialView: ExploreView, callbacks: GestureCallbacks) {
    this.canvas = canvas;
    this.view = { ...initialView };
    this.callbacks = callbacks;
    this.bind();
  }

  getView(): ExploreView {
    return { ...this.view };
  }

  setView(view: ExploreView): void {
    this.view = { ...view };
    this.stopInertia();
    this.publishView();
  }

  setViewClamp(clamp: ((view: ExploreView) => ExploreView) | null): void {
    this.viewClamp = clamp;
  }

  private publishView(): void {
    if (this.viewClamp) {
      this.view = this.viewClamp(this.view);
    }
    this.callbacks.onViewChange(this.getView());
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.pointers.clear();
      this.stopInertia();
    }
  }

  destroy(): void {
    this.stopInertia();
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
  }

  private bind(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    this.canvas.addEventListener('pointerleave', this.onPointerLeave);
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (!this.enabled) return;
    this.canvas.setPointerCapture(e.pointerId);
    this.stopInertia();

    const now = performance.now();
    this.pointers.set(e.pointerId, {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      startTime: now,
      didPan: false,
    });

    if (this.pointers.size === 2) {
      this.beginPinch();
    }
    this.callbacks.onPointerDown?.(e.clientX, e.clientY);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.enabled) return;
    const rec = this.pointers.get(e.pointerId);
    if (!rec) return;

    const now = performance.now();
    const dt = Math.max(now - this.lastMoveTime, 1);
    const dx = e.clientX - rec.lastX;
    const dy = e.clientY - rec.lastY;
    const { dx: rdx, dy: rdy } = mapClientDeltaToRenderer(this.canvas, dx, dy);
    const totalDist = Math.hypot(e.clientX - rec.startX, e.clientY - rec.startY);

    if (this.pointers.size === 1) {
      if (totalDist >= PAN_START_THRESHOLD_PX) {
        rec.didPan = true;
        this.view.panX += rdx;
        this.view.panY += rdy;
        this.velocityX = (rdx / dt) * 16;
        this.velocityY = (rdy / dt) * 16;
        this.publishView();
      }
    } else if (this.pointers.size >= 2) {
      this.updatePinch();
    }

    rec.lastX = e.clientX;
    rec.lastY = e.clientY;
    this.lastMoveTime = now;
    this.callbacks.onPointerMove?.(e.clientX, e.clientY, rec.didPan);
  };

  private onPointerUp = (e: PointerEvent): void => {
    const rec = this.pointers.get(e.pointerId);
    const multiPointer = this.pointers.size > 1;

    if (rec && this.pointers.size === 1) {
      const duration = performance.now() - rec.startTime;
      const dist = Math.hypot(e.clientX - rec.startX, e.clientY - rec.startY);
      const canvasDown = mapClientToRenderer(this.canvas, rec.startX, rec.startY);
      const canvasUp = mapClientToRenderer(this.canvas, e.clientX, e.clientY);

      let wasTap = false;
      let tapRejectedReason: TapGestureProbe['tapRejectedReason'] = 'none';

      if (!this.enabled) {
        tapRejectedReason = 'disabled';
      } else if (dist >= TAP_MOVE_THRESHOLD_PX) {
        // didPan だけでは拒否しない（PAN_START < TAP_MOVE のとき誤って drag 扱いになる）
        tapRejectedReason = 'moved-too-far';
      } else if (duration >= TAP_MAX_DURATION_MS) {
        tapRejectedReason = 'duration';
      } else {
        wasTap = true;
      }

      const probe: TapGestureProbe = {
        clientDownX: rec.startX,
        clientDownY: rec.startY,
        clientUpX: e.clientX,
        clientUpY: e.clientY,
        canvasDownX: canvasDown.x,
        canvasDownY: canvasDown.y,
        canvasUpX: canvasUp.x,
        canvasUpY: canvasUp.y,
        moveDistancePx: dist,
        durationMs: duration,
        wasDragging: dist >= TAP_MOVE_THRESHOLD_PX,
        wasTap,
        tapRejectedReason,
        tapMoveThresholdPx: TAP_MOVE_THRESHOLD_PX,
        tapMaxDurationMs: TAP_MAX_DURATION_MS,
        panStartThresholdPx: PAN_START_THRESHOLD_PX,
      };

      this.callbacks.onTapProbe?.(probe);

      if (this.enabled && wasTap) {
        this.callbacks.onTap(canvasUp.x, canvasUp.y, probe);
      } else if (this.enabled && rec.didPan && dist >= TAP_MOVE_THRESHOLD_PX) {
        this.startInertia();
      }
    } else if (rec && multiPointer) {
      const canvasDown = mapClientToRenderer(this.canvas, rec.startX, rec.startY);
      const canvasUp = mapClientToRenderer(this.canvas, e.clientX, e.clientY);
      this.callbacks.onTapProbe?.({
        clientDownX: rec.startX,
        clientDownY: rec.startY,
        clientUpX: e.clientX,
        clientUpY: e.clientY,
        canvasDownX: canvasDown.x,
        canvasDownY: canvasDown.y,
        canvasUpX: canvasUp.x,
        canvasUpY: canvasUp.y,
        moveDistancePx: Math.hypot(e.clientX - rec.startX, e.clientY - rec.startY),
        durationMs: performance.now() - rec.startTime,
        wasDragging: true,
        wasTap: false,
        tapRejectedReason: 'multiPointer',
        tapMoveThresholdPx: TAP_MOVE_THRESHOLD_PX,
        tapMaxDurationMs: TAP_MAX_DURATION_MS,
        panStartThresholdPx: PAN_START_THRESHOLD_PX,
      });
    }

    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0) {
      this.callbacks.onPointerUp?.();
    }
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  private onPointerLeave = (e: PointerEvent): void => {
    if (this.pointers.has(e.pointerId)) {
      this.onPointerUp(e);
    }
  };

  private beginPinch(): void {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return;
    const [a, b] = pts;
    this.pinchStartDistance = Math.hypot(b.lastX - a.lastX, b.lastY - a.lastY) || 1;
    this.pinchStartZoom = this.view.zoom;
    this.stopInertia();
  }

  /** ピンチ中心を基準にズーム（renderer 座標系） */
  private updatePinch(): void {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return;
    const [a, b] = pts;
    const dist = Math.hypot(b.lastX - a.lastX, b.lastY - a.lastY) || 1;
    const rawZoom = this.pinchStartZoom * (dist / this.pinchStartDistance);
    const newZoom = clamp(rawZoom, MIN_ZOOM, MAX_ZOOM);

    const pa = mapClientToRenderer(this.canvas, a.lastX, a.lastY);
    const pb = mapClientToRenderer(this.canvas, b.lastX, b.lastY);
    const cx = (pa.x + pb.x) / 2;
    const cy = (pa.y + pb.y) / 2;
    const ratio = newZoom / this.view.zoom;

    this.view.panX = cx - (cx - this.view.panX) * ratio;
    this.view.panY = cy - (cy - this.view.panY) * ratio;
    this.view.zoom = newZoom;

    this.publishView();
  }

  private startInertia(): void {
    this.stopInertia();
    const tick = () => {
      this.view.panX += this.velocityX;
      this.view.panY += this.velocityY;
      this.velocityX *= INERTIA_FRICTION;
      this.velocityY *= INERTIA_FRICTION;
      this.publishView();

      if (
        Math.abs(this.velocityX) > INERTIA_MIN_VELOCITY ||
        Math.abs(this.velocityY) > INERTIA_MIN_VELOCITY
      ) {
        this.inertiaRaf = requestAnimationFrame(tick);
      } else {
        this.inertiaRaf = null;
      }
    };
    this.inertiaRaf = requestAnimationFrame(tick);
  }

  private stopInertia(): void {
    if (this.inertiaRaf !== null) {
      cancelAnimationFrame(this.inertiaRaf);
      this.inertiaRaf = null;
    }
    this.velocityX = 0;
    this.velocityY = 0;
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** ホイール: 通常=ズーム / Shift+E-2=cameraDepth / Shift+E=flow speed */
export function attachExploreWheel(
  canvas: HTMLCanvasElement,
  getView: () => ExploreView,
  setView: (v: ExploreView) => void,
  isZoomEnabled: () => boolean,
  isDepthFlowWheelEnabled: () => boolean,
): () => void {
  let shiftHeld = false;

  const onWheel = (e: WheelEvent): void => {
    const depthFlowWheel = (e.shiftKey || shiftHeld) && isDepthFlowWheelEnabled();

    if (depthFlowWheel) {
      e.preventDefault();
      if (isCameraNavigationMode()) {
        applySceneTimeWheel(e);
      } else if (isObjectFlowMode()) {
        applyDepthFlowWheelFromEvent(e);
      }
      return;
    }

    if (isObjectFlowMode()) {
      clearDepthFlowWheelBoost();
    } else if (isCameraNavigationMode()) {
      clearSceneTimeWheelBoost();
    }

    if (!isZoomEnabled()) return;
    e.preventDefault();
    const view = getView();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    const newZoom = clamp(view.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    const p = isCameraNavigationMode()
      ? mapCanvasCenterToRenderer(canvas)
      : mapClientToRenderer(canvas, e.clientX, e.clientY);
    const ratio = newZoom / view.zoom;
    setView({
      zoom: newZoom,
      panX: p.x - (p.x - view.panX) * ratio,
      panY: p.y - (p.y - view.panY) * ratio,
    });
  };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Shift') {
      shiftHeld = true;
    }
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    if (e.key === 'Shift') {
      shiftHeld = false;
      if (isObjectFlowMode()) {
        clearDepthFlowWheelBoost();
      } else if (isCameraNavigationMode()) {
        clearSceneTimeWheelBoost();
      }
    }
  };

  canvas.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  return () => {
    canvas.removeEventListener('wheel', onWheel);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    clearDepthFlowWheelBoost();
    clearSceneTimeWheelBoost();
  };
}

/** @deprecated attachExploreWheel を使用 */
export function attachWheelZoom(
  canvas: HTMLCanvasElement,
  getView: () => ExploreView,
  setView: (v: ExploreView) => void,
  isEnabled: () => boolean,
): () => void {
  return attachExploreWheel(canvas, getView, setView, isEnabled, () => false);
}
