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

/** MeshBasicMaterial: 通常は白黒、screen-space 円内だけカラー復帰。 */
export function attachBubbleRevealShader(
  material: THREE.MeshBasicMaterial,
  uniforms: RevealUniforms,
): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRevealCenterNdc = uniforms.uRevealCenterNdc;
    shader.uniforms.uRevealRadiusPx = uniforms.uRevealRadiusPx;
    shader.uniforms.uResolution = uniforms.uResolution;
    shader.uniforms.uRevealActive = uniforms.uRevealActive;

    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      /* glsl */ `
      uniform vec2 uRevealCenterNdc;
      uniform float uRevealRadiusPx;
      uniform vec2 uResolution;
      uniform float uRevealActive;
      void main() {
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      /* glsl */ `
      #include <map_fragment>
      vec3 colorSample = diffuseColor.rgb;
      float gray = dot(colorSample, vec3(0.299, 0.587, 0.114));
      vec3 graySample = vec3(gray);
      vec2 fragNdc = (gl_FragCoord.xy / max(uResolution, vec2(1.0))) * 2.0 - 1.0;
      vec2 delta = fragNdc - uRevealCenterNdc;
      float distPx = length(delta * uResolution * 0.5);
      float edge = 1.0;
      float reveal = (1.0 - smoothstep(uRevealRadiusPx - edge, uRevealRadiusPx + edge, distPx)) * uRevealActive;
      diffuseColor.rgb = mix(graySample, colorSample, reveal);
      `,
    );
  };
  material.customProgramCacheKey = () => 'bubble-reveal-0820';
  material.needsUpdate = true;
}
