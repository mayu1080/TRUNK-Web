import type { DebugStats } from '../pixi/types';
import { IMAGE_ZOOM_CARD_DELAY_FRAMES, MOTION_CONFIG } from '../motionConfig';

interface DebugPanelProps {
  stats: DebugStats | null;
  warnings: string[];
  lastAction: string;
}

function DebugPanelBlock({ lines }: { lines: string[] }) {
  return <pre className="debug-panel">{lines.join('\n')}</pre>;
}

export function DebugPanel({ stats, warnings, lastAction }: DebugPanelProps) {
  if (!stats) {
    return (
      <div className="debug-panels">
        <DebugPanelBlock lines={['=== DD: loading… ===']} />
      </div>
    );
  }

  const zoom = MOTION_CONFIG.imageZoomOpen;
  const drawer = MOTION_CONFIG.drawer;
  const tap = MOTION_CONFIG.tapReaction;
  const zoomOpenTotalMs = zoom.cardDelayMs + zoom.cardFadeMs;
  const zoomCloseMs = Math.round(zoom.cardFadeMs * 0.85);

  const configLines = [
    '=== DD: Pixi + Three風 + DOM ===',
    'url: http://localhost:5175',
    `visual preset: ${stats.visualPreset}`,
    `tone preset: ${stats.tonePreset}  bright: ${stats.imageBrightness}  contrast: ${stats.imageContrast}`,
    `noise: ${stats.noiseEnabled ? 'ON' : 'OFF'}  opacity: ${stats.noiseOpacity}`,
    `depth: ${stats.depthEnabled ? 'ON' : 'OFF'}  layers: ${stats.depthLayers}  parallax: ${stats.parallaxStrength}`,
    `float: ${stats.floatEnabled ? 'ON (legacy)' : 'OFF'}  idle: ${stats.idleMotionEnabled ? 'ON' : 'OFF'}`,
    `idle sample: dy=${stats.idleSampleY.toFixed(2)} rot=${stats.idleSampleRotDeg.toFixed(3)}°`,
    `touch reaction: ${stats.touchReactionEnabled ? 'ON' : 'OFF'}  str: ${stats.touchReactionStrength}`,
    '',
    '--- IMAGE_ZOOM timeline ---',
    `tap bright: ${tap.riseMs}ms${tap.holdMs > 0 ? ` + hold ${tap.holdMs}ms` : ''} (parallel, scale ${tap.scaleTo === 1 ? 'off' : tap.scaleTo})`,
    `scrim fade: ${zoom.scrimFadeMs}ms  opacity max: ${zoom.scrimOpacityMax}  blur: ${zoom.scrimBlurPx}px`,
    `card delay: ${zoom.cardDelayMs}ms (${IMAGE_ZOOM_CARD_DELAY_FRAMES} frames @60fps)  card fade: ${zoom.cardFadeMs}ms`,
    `easing: easeInOutCubic [${zoom.cardEasing.join(', ')}]`,
    `open total: ~${zoomOpenTotalMs}ms (delay+card)  close: ~${zoomCloseMs}ms`,
    '',
    '--- drawer timeline ---',
    `panel open: ${drawer.openMs}ms  close: ${drawer.closeMs}ms  slide from: ${drawer.translateFromX}px`,
    `scrim fade: ${drawer.scrimFadeMs}ms`,
    `easing: easeInQuad (gentle) [${drawer.easing.join(', ')}]`,
    '',
    `overlay: ${stats.overlayState}  drawer: ${stats.drawerOpen ? 'OPEN' : 'closed'}`,
    `pointer blocked: ${stats.pointerBlocked}  interaction: ${stats.interactionEnabled ? 'ON' : 'OFF'}`,
    `tap locked: ${stats.tapLocked}  hit debug: ${stats.hitTestDebugEnabled ? 'ON' : 'OFF'}`,
    `last action: ${lastAction}`,
  ];

  const runtimeLines = [
    '--- runtime ---',
    `FPS: ${stats.fps.toFixed(1)}  canvas: ${stats.canvasCount}  renderer: ${stats.rendererType}`,
    `images: ${stats.displayedImageCount} (real ${stats.realImageCount})  tex: ${stats.texturesLoaded}`,
    `texMem(est): ${stats.textureMemoryMb.toFixed(2)} MB  drawCalls(est): ${stats.drawCallEstimate}`,
    `pan: ${stats.panX.toFixed(0)}, ${stats.panY.toFixed(0)}  zoom: ${stats.zoom.toFixed(3)}`,
    `selectedImageId: ${stats.selectedImageId ?? '(none)'}`,
  ];

  if (stats.selectedImage) {
    const s = stats.selectedImage;
    runtimeLines.push(
      `selected depth: ${s.depth.toFixed(2)}  preset: ${s.preset}`,
      `  displayed: ${Math.round(s.displayedWidth)}×${Math.round(s.displayedHeight)}`,
    );
  }

  const ht = stats.hitTestDebug;
  if (ht) {
    runtimeLines.push(
      '',
      '--- hit test ---',
      `last pointer: client (${ht.clientUpX.toFixed(0)}, ${ht.clientUpY.toFixed(0)})`,
      `canvas point: (${ht.canvasUpX.toFixed(1)}, ${ht.canvasUpY.toFixed(1)})`,
      `world point: (${ht.worldUpX.toFixed(1)}, ${ht.worldUpY.toFixed(1)})`,
      `pointer target: ${ht.pointerTarget}  domBlocksCanvas: ${ht.domBlocksCanvas}`,
      `elementsFromPoint top: ${ht.elementsFromPointTop}`,
      `down/up distance: ${ht.moveDistancePx.toFixed(1)}px  duration: ${ht.durationMs.toFixed(0)}ms`,
      `wasTap: ${ht.wasTap}  wasDragging: ${ht.wasDragging}`,
      `tapRejectedReason: ${ht.tapRejectedReason}`,
      `thresholds: move<=${ht.tapMoveThresholdPx}px dur<=${ht.tapMaxDurationMs}ms pan>=${ht.panStartThresholdPx}px`,
      `hit candidates: ${ht.hitCandidateCount}`,
    );
    for (const [i, c] of ht.hitCandidates.slice(0, 5).entries()) {
      runtimeLines.push(
        `  ${i + 1}. ${c.imageId} d=${c.depth.toFixed(2)} ${c.layerId} z=${c.zIndex} ord=${c.renderOrder}`,
      );
    }
    if (ht.hitCandidateCount > 5) {
      runtimeLines.push(`  … +${ht.hitCandidateCount - 5} more`);
    }
    runtimeLines.push(`chosen imageId: ${ht.chosenImageId ?? '(none)'}`);
    if (ht.chosenBounds) {
      const b = ht.chosenBounds;
      runtimeLines.push(
        `chosen bounds: x=${b.x.toFixed(0)} y=${b.y.toFixed(0)} w=${b.w.toFixed(0)} h=${b.h.toFixed(0)}`,
      );
    }
    if (ht.chosenAtDownImageId && ht.chosenAtDownImageId !== ht.chosenImageId) {
      runtimeLines.push(`down-position hit: ${ht.chosenAtDownImageId} (≠ up)`);
    }
  }

  if (warnings.length > 0) {
    runtimeLines.push('', '--- warnings ---');
    for (const w of warnings.slice(0, 4)) runtimeLines.push(`⚠ ${w}`);
  }

  return (
    <div className="debug-panels">
      <DebugPanelBlock lines={configLines} />
      <DebugPanelBlock lines={runtimeLines} />
    </div>
  );
}
