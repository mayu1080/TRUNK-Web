import type { MotionConfig } from '../motionConfig';
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
): IdleMotionOffsets {
  const { idle } = motion;
  if (!idle.enabled) {
    return { offsetX: 0, offsetY: 0, scaleMul: 1, rotation: 0 };
  }

  const profile = idle.depthProfile[item.layerId];
  const t = item.idleIntensity;
  const speed = item.idleSpeed;

  // near レイヤを基準（1.0）に far/mid を段階的に抑える
  const nearY = idle.depthProfile.near.yAmp;
  const depthY = profile.yAmp / nearY;
  const depthX = profile.xAmp / idle.depthProfile.near.xAmp;
  const depthScale = profile.scaleAmp / idle.depthProfile.near.scaleAmp;
  const depthRot = profile.rotAmpDeg / idle.depthProfile.near.rotAmpDeg;

  const yAmp = lerp(idle.yAmplitudeMin, idle.yAmplitudeMax, t) * depthY;
  const xAmp = lerp(idle.xAmplitudeMin, idle.xAmplitudeMax, t) * depthX;
  const scaleAmp = lerp(idle.scaleAmplitudeMin, idle.scaleAmplitudeMax, t) * depthScale;
  const rotAmp =
    lerp(idle.rotationAmplitudeDegMin, idle.rotationAmplitudeDegMax, t) * depthRot * DEG;

  const offsetY = Math.sin(time * speed + item.idlePhaseY) * yAmp;
  const offsetX = Math.sin(time * speed * 0.71 + item.idlePhaseX + 0.9) * xAmp;
  const scaleMul = 1 + Math.sin(time * speed * 0.53 + item.idlePhaseScale) * scaleAmp;
  const rotation = Math.sin(time * speed * 0.61 + item.idlePhaseRot + 0.4) * rotAmp;

  return { offsetX, offsetY, scaleMul, rotation };
}
