export class FpsCounter {
  private frames = 0;
  private lastTime = performance.now();
  private fps = 0;

  tick(): number {
    this.frames += 1;
    const now = performance.now();
    const elapsed = now - this.lastTime;
    if (elapsed >= 500) {
      this.fps = (this.frames * 1000) / elapsed;
      this.frames = 0;
      this.lastTime = now;
    }
    return this.fps;
  }
}
