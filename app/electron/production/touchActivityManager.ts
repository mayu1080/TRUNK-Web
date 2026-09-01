import type { GlobalScene, IdleDebugInfo } from '../../shared/productionState';

export class TouchActivityManager {
  private lastValidTouchAtMs: number | null = null;
  private armed = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly getTimeoutSeconds: () => number,
    private readonly source: IdleDebugInfo['source'],
    private readonly onTimeout: () => void,
  ) {}

  onScene(scene: GlobalScene): void {
    if (scene === 'PRODUCT_LIST') {
      this.armed = true;
      this.lastValidTouchAtMs = Date.now();
      this.reschedule();
      return;
    }
    this.armed = false;
    this.lastValidTouchAtMs = null;
    this.clearTimer();
  }

  noteValidTouch(): void {
    if (!this.armed) return;
    this.lastValidTouchAtMs = Date.now();
    this.reschedule();
  }

  dump(): IdleDebugInfo {
    return {
      timeoutSeconds: this.getTimeoutSeconds(),
      source: this.source,
      armed: this.armed,
      lastValidTouchAtMs: this.lastValidTouchAtMs,
    };
  }

  destroy(): void {
    this.clearTimer();
  }

  private reschedule(): void {
    this.clearTimer();
    if (!this.armed) return;
    const ms = Math.max(1, this.getTimeoutSeconds() * 1000);
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.armed) return;
      this.onTimeout();
    }, ms);
  }

  private clearTimer(): void {
    if (this.timer != null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
