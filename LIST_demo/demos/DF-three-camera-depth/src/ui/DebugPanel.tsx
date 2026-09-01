import type { DebugStats } from '../types';
import { DEMO_NAME, DEMO_URL } from '../demoIdentity';
import type { OverlayState } from '../motionConfig';
import { CAMERA_CONFIG } from '../three/sceneLayout';

interface DebugPanelProps {
  stats: DebugStats | null;
  warnings: string[];
  lastAction: string;
  overlayState: OverlayState;
}

export function DebugPanel({ stats, warnings, lastAction, overlayState }: DebugPanelProps) {
  if (!stats) {
    return (
      <div className="debug-panels">
        <pre className="debug-panel">=== DF: loading… ===</pre>
      </div>
    );
  }

  const lines = [
    `=== ${DEMO_NAME} ===`,
    `url: ${DEMO_URL}`,
    `demo: ${DEMO_NAME}`,
    `renderer: ${stats.rendererType}`,
    `canvas count: ${stats.canvasCount}`,
    `image meshes: ${stats.imageMeshCount}  textures: ${stats.textureCount}`,
    `FPS: ${stats.fps.toFixed(1)}`,
    '',
    `camera: ${stats.cameraX.toFixed(0)}, ${stats.cameraY.toFixed(0)}, ${stats.cameraZ.toFixed(0)}`,
    `target camera: ${stats.targetCameraX.toFixed(0)}, ${stats.targetCameraY.toFixed(0)}, ${stats.targetCameraZ.toFixed(0)}`,
    `timelinePosition: ${stats.timelinePosition.toFixed(3)}  target: ${stats.targetTimelinePosition.toFixed(3)}`,
    `dolly cruise: vZ=${stats.cruiseVelocityZ.toFixed(0)}  active=${stats.cruiseActive}  Shift=${stats.shiftHeld}`,
    `fov: ${stats.cameraFov.toFixed(1)}° (base ${CAMERA_CONFIG.fov}° + breathe)`,
    `visual preset: ${stats.visualPreset}  hit debug: ${stats.hitTestDebugEnabled ? 'ON' : 'OFF'}`,
    `wheel: ${stats.wheelControls}`,
    `drag controls: ${stats.dragControls}`,
    `tap selection: ${stats.tapSelection}`,
    '',
    `raycast candidates: ${stats.raycastCandidateCount}`,
    `chosen imageId: ${stats.chosenImageId ?? '(none)'}`,
    `chosen distance: ${stats.chosenDistance?.toFixed(1) ?? '—'}`,
    `selectedImageId: ${stats.selectedImageId ?? '(none)'}`,
    `overlay open: ${stats.overlayOpen}  drawer open: ${stats.drawerOpen}`,
    `interaction: ${stats.interactionEnabled ? 'ON' : 'OFF'}  overlayState: ${overlayState}`,
    '',
    `images: ${stats.displayedImageCount} (real ${stats.realImageCount})  asset: ${stats.assetMode}`,
    `last action: ${lastAction}`,
  ];

  if (warnings.length > 0) {
    lines.push('', '--- warnings ---');
    for (const w of warnings.slice(0, 4)) lines.push(`⚠ ${w}`);
  }

  return (
    <div className="debug-panels">
      <pre className="debug-panel">{lines.join('\n')}</pre>
    </div>
  );
}
