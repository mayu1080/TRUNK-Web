export class FpsCounter {
  private frames = 0;
  private lastMs = performance.now();
  private fps = 0;

  tick(): number {
    this.frames += 1;
    const now = performance.now();
    if (now - this.lastMs >= 500) {
      this.fps = (this.frames * 1000) / (now - this.lastMs);
      this.frames = 0;
      this.lastMs = now;
    }
    return this.fps;
  }
}
