import type { DepthFlowMode } from './motionConfig';
import { MOTION_CONFIG } from './motionConfig';
import { resetCameraZ } from './pixi/cameraDepth';
import { resetDepthFlowSpeed } from './pixi/depthFlowSpeed';

export type DemoId = 'DD' | 'DE';

const rawId = import.meta.env.VITE_DEMO_ID;
export const DEMO_ID: DemoId = rawId === 'DE' ? 'DE' : 'DD';
export const DEMO_URL = import.meta.env.VITE_DEMO_URL ?? 'http://localhost:5175';

export const DEFAULT_DEPTH_MODE: DepthFlowMode =
  DEMO_ID === 'DE' ? 'camera-navigation' : 'object-flow';

/** デモ起動時に depth モード等を固定（DD=E / DE=E-2） */
export function applyDemoDefaults(): void {
  MOTION_CONFIG.depthFlow.depthMode = DEFAULT_DEPTH_MODE;
  if (DEFAULT_DEPTH_MODE === 'camera-navigation') {
    resetCameraZ();
  } else {
    resetDepthFlowSpeed();
  }
}
