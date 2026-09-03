import * as THREE from 'three';

export interface RevealUniforms {
  uRevealCenterNdc: { value: THREE.Vector2 };
  uRevealRadiusPx: { value: number };
  uResolution: { value: THREE.Vector2 };
  uRevealActive: { value: number };
}

export function createRevealUniforms(): RevealUniforms {
  return {
    uRevealCenterNdc: { value: new THREE.Vector2(0, 0) },
    uRevealRadiusPx: { value: 160 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uRevealActive: { value: 0 },
  };
}

/**
 * 0820-color: 白黒フィルタ / Bubble Color Reveal は付けない。
 * MeshBasicMaterial のテクスチャ色をそのまま出す。
 * Bubble overlay 自体は残る（装飾）。円内だけ色が戻る処理はしない。
 */
export function attachBubbleRevealShader(
  _material: THREE.MeshBasicMaterial,
  _uniforms: RevealUniforms,
): void {
  /* no-op: keep call sites identical to demo-0820 */
}
