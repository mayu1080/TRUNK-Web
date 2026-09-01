import type { DebugStats } from '../pixi/types';
import { DEMO_ID, DEMO_URL } from '../demoIdentity';
import { IMAGE_ZOOM_CARD_DELAY_FRAMES, MOTION_CONFIG } from '../motionConfig';
import { getSceneTimeWheelDebug } from '../pixi/cameraDepth';

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

  const isCameraNav = stats.depthFlowMode === 'camera-depth-navigation';
  const cam = MOTION_CONFIG.cameraDepth;
  const timeDbg = isCameraNav ? getSceneTimeWheelDebug() : null;
  const depthSection = isCameraNav
    ? [
        '--- DD-E2 camera depth / time control ---',
        `demo: DD-E2-camera-depth-navigation`,
        `mode: camera-depth-navigation`,
        `timeControl: ON  objectFlow: OFF  flowSpeedControl: OFF`,
        `shiftWheel: ${timeDbg?.direction === 'fast' ? 'time forward' : timeDbg?.direction === 'rewind' ? 'time rewind' : 'idle (×1)'}`,
        `timeScale: ${stats.sceneTimeScale.toFixed(3)}  target: ${stats.targetSceneTimeScale.toFixed(3)}${stats.sceneTimeWheelBoost ? ' (Shift+wheel)' : ''}`,
        `drift: base ${cam.sceneDriftSpeed} × time → ${stats.effectiveSceneDriftSpeed.toFixed(1)} unit/s`,
        `boost: forward ×${cam.timeWheelFastScale} / rewind ×${cam.timeWheelRewindScale}  (Shift離す=×1 正向き)`,
        `last wheel: Δ${timeDbg?.axis}=${timeDbg?.axis === 'x' ? timeDbg?.deltaX.toFixed(1) : timeDbg?.deltaY.toFixed(1)} → ${timeDbg?.direction ?? 'none'}`,
        `cameraZ: ${stats.cameraZ.toFixed(0)} (空間固定)  lookAt: screen-center`,
        `focalLength: ${cam.focalLength}  sceneZ: ${cam.minSceneZ}–${cam.maxSceneZ}`,
        `depth: far=opaque+weakBlur(hit) → clear(hit) → nearFade(no hit)`,
        `zones: blur>${cam.clearZoneFar}  clear[${cam.clearZoneNear}–${cam.clearZoneFar}]  fade→${cam.nearFadeEnd}`,
        `hit: until fade-start+grace (relZ≥nearFadeStart-12%)  farClip: ${cam.farFadeStart}→${cam.farFadeEnd}`,
        `sceneZ respawn: ON (clip抜け後)  count: ${stats.depthFlowRespawnCount}`,
        `wheel: Shift+↑=加速×${cam.timeWheelFastScale}(奥→手前)  Shift+↓=巻戻×${cam.timeWheelRewindScale}(手前→奥)`,
      ]
    : [
        '--- depth flow (E) ---',
        `enabled: ${stats.depthFlowEnabled ? 'ON' : 'OFF'}  mode: ${stats.depthFlowMode}  parallax: ${stats.parallaxMode}`,
        `baseSpeed: ${stats.depthFlowBaseSpeed.toFixed(4)}  speedMult: ${stats.depthFlowSpeedMultiplier.toFixed(2)}  dir: ${stats.depthFlowSpeedDirection > 0 ? '奥→手前' : '手前→奥'}${stats.depthFlowWheelBoost ? ' (Shift+wheel)' : ''}`,
        `effective: ${stats.depthFlowEffectiveSpeed.toFixed(4)}  step: ×${MOTION_CONFIG.depthFlow.wheelStepFactor} per Shift+wheel`,
        `last wheel: Δ${stats.depthFlowWheelAxis}=${stats.depthFlowWheelAxis === 'x' ? stats.depthFlowWheelDeltaX.toFixed(1) : stats.depthFlowWheelDeltaY.toFixed(1)} (Δx=${stats.depthFlowWheelDeltaX.toFixed(1)} Δy=${stats.depthFlowWheelDeltaY.toFixed(1)})`,
        `speed range: ${stats.depthFlowMinSpeedMultiplier}–${stats.depthFlowMaxSpeedMultiplier}  respawns: ${stats.depthFlowRespawnCount}`,
        `sample: depth=${stats.depthFlowSampleDepth.toFixed(3)} label=${stats.depthFlowSampleLabel} speed=${stats.depthFlowSpeed.toFixed(4)} ord=${stats.depthFlowSampleRenderOrder}`,
        `4段階 alpha: [${MOTION_CONFIG.depthFlow.alphaByStage.join(', ')}]`,
        `4段階 blur: [${MOTION_CONFIG.depthFlow.blurByStage.join(', ')}]`,
        `4段階 scale: [${MOTION_CONFIG.depthFlow.scaleByStage.join(', ')}]`,
        `wheel: Shift+↑=正×${MOTION_CONFIG.depthFlow.wheelStepFactor}  Shift+↓=逆×${MOTION_CONFIG.depthFlow.wheelStepFactor}  (plain=zoom)`,
      ];

  const configLines = [
    `=== ${DEMO_ID}: ${DEMO_ID === 'DE' ? 'Camera Depth (E-2)' : 'Pixi + Three風 + DOM (E)'} ===`,
    `url: ${DEMO_URL}`,
    `visual preset: ${stats.visualPreset}`,
    `tone preset: ${stats.tonePreset}  bright: ${stats.imageBrightness}  contrast: ${stats.imageContrast}`,
    `noise: ${stats.noiseEnabled ? 'ON' : 'OFF'}  opacity: ${stats.noiseOpacity}`,
    `depth: ${stats.depthEnabled ? 'ON' : 'OFF'}  layers: ${stats.depthLayers}  parallax: ${stats.parallaxStrength}`,
    `float: ${stats.floatEnabled ? 'ON (legacy)' : 'OFF'}  idle: ${stats.idleMotionEnabled ? 'ON' : 'OFF'}`,
    `idle sample: dy=${stats.idleSampleY.toFixed(2)} rot=${stats.idleSampleRotDeg.toFixed(3)}°`,
    `touch reaction: ${stats.touchReactionEnabled ? 'ON' : 'OFF'}  str: ${stats.touchReactionStrength}`,
    '',
    ...depthSection,
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

  if (stats.selectedImageId) {
    if (isCameraNav) {
      runtimeLines.push(
        `selected sceneZ: ${stats.selectedSceneZ?.toFixed(1) ?? '—'}  relativeZ: ${stats.selectedRelativeZ?.toFixed(1) ?? '—'}`,
        `selected perspective: ${stats.selectedPerspective?.toFixed(4) ?? '—'}  alpha: ${stats.selectedAlpha?.toFixed(3) ?? '—'}  scale: ${stats.selectedScale?.toFixed(3) ?? '—'}`,
        `selected renderOrder: ${stats.selectedRenderOrder ?? '—'}`,
      );
    } else if (stats.selectedFlowDepth != null) {
      runtimeLines.push(
        `selected flowDepth: ${stats.selectedFlowDepth.toFixed(3)}  label: ${stats.selectedDepthLabel ?? '—'}`,
        `selected flowSpeed: ${stats.selectedFlowSpeed?.toFixed(4) ?? '—'}  alpha: ${stats.selectedAlpha?.toFixed(3) ?? '—'}  scale: ${stats.selectedScale?.toFixed(3) ?? '—'}`,
        `selected renderOrder: ${stats.selectedRenderOrder ?? '—'}`,
      );
    }
  }

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
      '--- hit debug ---',
      `hit debug: ${stats.hitTestDebugEnabled ? 'ON' : 'OFF'}`,
      `last pointerup: ${ht.clientUpX.toFixed(0)}, ${ht.clientUpY.toFixed(0)}`,
      `pointer local/canvas: ${ht.canvasUpX.toFixed(1)}, ${ht.canvasUpY.toFixed(1)}`,
      `canvas rect: ${ht.canvasRectLeft.toFixed(0)}, ${ht.canvasRectTop.toFixed(0)} ${ht.canvasRectWidth.toFixed(0)}x${ht.canvasRectHeight.toFixed(0)}`,
      `renderer resolution: ${ht.rendererResolution.toFixed(2)}`,
      `moveDistance: ${ht.moveDistancePx.toFixed(1)}px  durationMs: ${ht.durationMs.toFixed(0)}`,
      `tapRejectedReason: ${ht.tapRejectedReason}`,
      `hitTestExecuted: ${ht.hitTestExecuted}`,
      `candidates before: ${ht.candidatesBeforeFilter}  after vis: ${ht.candidatesAfterVisibility}`,
      `after alpha: ${ht.candidatesAfterAlpha}  final: ${ht.candidatesFinal}`,
      `thresholds: move<=${ht.tapMoveThresholdPx}px dur<=${ht.tapMaxDurationMs}ms pan>=${ht.panStartThresholdPx}px`,
      `tapLocked: ${ht.tapLocked}  cooldown remaining: ${ht.cooldownRemainingMs.toFixed(0)}ms`,
      `overlay blocking: ${ht.overlayBlocking}  domBlocksCanvas: ${ht.domBlocksCanvas}`,
      `pointer target: ${ht.pointerTarget}  top: ${ht.elementsFromPointTop}`,
    );
    for (const [i, c] of ht.hitCandidates.slice(0, 5).entries()) {
      runtimeLines.push(
        `  cand ${i + 1}. ${c.imageId} ord=${c.renderOrder} α=${c.alpha.toFixed(2)} bounds=${c.bounds.w.toFixed(0)}x${c.bounds.h.toFixed(0)}`,
      );
    }
    if (ht.hitCandidateCount > 5) {
      runtimeLines.push(`  … +${ht.hitCandidateCount - 5} more`);
    }
    runtimeLines.push(
      `chosen imageId: ${ht.chosenImageId ?? '(none)'}`,
      `chosen renderOrder: ${ht.chosenRenderOrder ?? '—'}  chosen alpha: ${ht.chosenAlpha?.toFixed(2) ?? '—'}`,
    );
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
