import type { MotionConfig } from '../motionConfig';
import { smoothstep } from './depthFlowMotion';
import type { PlacedImage } from './exploreScene';

export interface IdleMotionOffsets {
  offsetX: number;
  offsetY: number;
  scaleMul: number;
  rotation: number;
}

const DEG = Math.PI / 180;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 配置時に画像ごとの個体差パラメータを付与 */
export function initIdleParams(
  item: Pick<PlacedImage, 'idleIntensity' | 'idleSpeed' | 'idlePhaseX' | 'idlePhaseY' | 'idlePhaseScale' | 'idlePhaseRot'>,
  rand: () => number,
  motion: MotionConfig,
): void {
  const { idle } = motion;
  item.idleIntensity = 0.25 + rand() * 0.75;
  item.idleSpeed = lerp(idle.speedMin, idle.speedMax, rand());
  if (idle.phaseRandom) {
    item.idlePhaseX = rand() * Math.PI * 2;
    item.idlePhaseY = rand() * Math.PI * 2;
    item.idlePhaseScale = rand() * Math.PI * 2;
    item.idlePhaseRot = rand() * Math.PI * 2;
  } else {
    item.idlePhaseX = 0;
    item.idlePhaseY = 0;
    item.idlePhaseScale = 0;
    item.idlePhaseRot = 0;
  }
}

export function computeIdleMotion(
  item: PlacedImage,
  time: number,
  motion: MotionConfig,
  relativeZ?: number,
): IdleMotionOffsets {
  const { idle } = motion;
  if (!idle.enabled) {
    return { offsetX: 0, offsetY: 0, scaleMul: 1, rotation: 0 };
  }

  const { far, near } = idle.depthProfile;
  const depthT =
    relativeZ !== undefined
      ? smoothstep(0, 1, Math.max(0, Math.min(1, 1 - relativeZ / 2000)))
      : smoothstep(0, 1, item.flowDepth);
  const yAmp =
    lerp(idle.yAmplitudeMin, idle.yAmplitudeMax, item.idleIntensity) *
    lerp(far.yAmp, near.yAmp, depthT) /
    near.yAmp;
  const xAmp =
    lerp(idle.xAmplitudeMin, idle.xAmplitudeMax, item.idleIntensity) *
    lerp(far.xAmp, near.xAmp, depthT) /
    near.xAmp;
  const scaleAmp =
    lerp(idle.scaleAmplitudeMin, idle.scaleAmplitudeMax, item.idleIntensity) *
    lerp(far.scaleAmp, near.scaleAmp, depthT) /
    near.scaleAmp;
  const rotAmp =
    lerp(idle.rotationAmplitudeDegMin, idle.rotationAmplitudeDegMax, item.idleIntensity) *
    lerp(far.rotAmpDeg, near.rotAmpDeg, depthT) /
    near.rotAmpDeg *
    DEG;

  const speed = item.idleSpeed;
  const offsetY = Math.sin(time * speed + item.idlePhaseY) * yAmp;
  const offsetX = Math.sin(time * speed * 0.71 + item.idlePhaseX + 0.9) * xAmp;
  const scaleMul = 1 + Math.sin(time * speed * 0.53 + item.idlePhaseScale) * scaleAmp;
  const rotation = Math.sin(time * speed * 0.61 + item.idlePhaseRot + 0.4) * rotAmp;

  return { offsetX, offsetY, scaleMul, rotation };
}
