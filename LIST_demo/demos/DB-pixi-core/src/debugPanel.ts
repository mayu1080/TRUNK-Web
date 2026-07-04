import type { DebugStats } from './types';

export class DebugPanel {
  private el: HTMLElement;

  constructor(elementId = 'debug-panel') {
    const el = document.getElementById(elementId);
    if (!el) throw new Error(`#${elementId} not found`);
    this.el = el;
  }

  render(stats: DebugStats, warnings: string[]): void {
    const lines = [
      '=== DB: Pixi探索コア ===',
      `asset mode: ${stats.assetMode}`,
      `source: ${stats.sourceRoot}`,
      `folders: ${stats.scannedFolders || '(none)'}`,
      `real images: ${stats.realImageCount}  displayed: ${stats.displayedImageCount}`,
      `duplicates: ${stats.duplicatedCount}  textures: ${stats.texturesLoaded}`,
      `warnings: ${stats.warningCount}`,
      '',
      'display size:',
      `  min: ${stats.displayMinLongSide.toFixed(0)}px`,
      `  max: ${stats.displayMaxLongSide.toFixed(0)}px`,
      `  avg: ${stats.displayAvgLongSide.toFixed(0)}px`,
      `  maxLongSide: ${stats.maxTargetLongSide}px`,
      `  presets: ${stats.presetDistribution}`,
      '',
      `FPS: ${stats.fps.toFixed(1)}  renderer: ${stats.rendererType}  canvas: ${stats.canvasCount}`,
      `pan: ${stats.panX.toFixed(1)}, ${stats.panY.toFixed(1)}  zoom: ${stats.zoom.toFixed(3)}`,
      `selectedImageId: ${stats.selectedImageId ?? '(none)'}`,
    ];

    if (stats.selectedImage) {
      const s = stats.selectedImage;
      lines.push(
        'selected:',
        `  id: ${s.id}`,
        `  original: ${s.originalWidth} x ${s.originalHeight}`,
        `  displayed: ${Math.round(s.displayedWidth)} x ${Math.round(s.displayedHeight)}`,
        `  scale: ${s.scale.toFixed(3)}  preset: ${s.preset}`,
      );
    }

    lines.push(
      `drawCalls(est): ${stats.drawCallEstimate}  texMem(est): ${stats.textureMemoryMb.toFixed(2)} MB`,
      `load: ${stats.loadTimeMs.toFixed(0)} ms  init: ${stats.initTimeMs.toFixed(0)} ms`,
      `dpr: ${stats.devicePixelRatio}  interaction: ${stats.interactionEnabled ? 'ON' : 'OFF'}`,
      `overlay: ${stats.overlayOpen ? 'OPEN' : 'closed'}`,
    );

    if (warnings.length > 0) {
      lines.push('', '--- warnings ---');
      for (const w of warnings.slice(0, 6)) {
        lines.push(`⚠ ${w}`);
      }
      if (warnings.length > 6) {
        lines.push(`… +${warnings.length - 6} more`);
      }
    }

    this.el.textContent = lines.join('\n');
    this.el.classList.toggle('warn', warnings.length > 0);
  }
}

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

function formatPresetDistribution(counts: { small: number; medium: number; large: number }): string {
  const total = counts.small + counts.medium + counts.large;
  if (total === 0) return 'small 0% / medium 0% / large 0%';
  const pct = (n: number) => Math.round((n / total) * 100);
  return `small ${pct(counts.small)}% / medium ${pct(counts.medium)}% / large ${pct(counts.large)}%`;
}

export { formatPresetDistribution };
