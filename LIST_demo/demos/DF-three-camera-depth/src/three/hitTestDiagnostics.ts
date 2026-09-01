import * as THREE from 'three';
import { HIT_TEST_MIN_ALPHA } from './sceneLayout';

export interface HitTestCandidateBounds {
  /** CSS client px */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HitTestCandidate {
  imageId: string;
  distance: number;
  alpha: number;
  bounds: HitTestCandidateBounds;
}

export interface HitTestDebugSnapshot {
  clientX: number;
  clientY: number;
  wasTap: boolean;
  tapRejectedReason: 'none' | 'noCandidate' | 'drag' | 'duration' | 'blocked';
  hitCandidates: HitTestCandidate[];
  chosenImageId: string | null;
  chosenDistance: number | null;
}

const _corner = new THREE.Vector3();
const _ndc = new THREE.Vector2();

/** mesh 平面の 4 隅を client 座標の AABB に投影 */
export function projectMeshClientBounds(
  mesh: THREE.Mesh,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
): HitTestCandidateBounds {
  const geom = mesh.geometry as THREE.PlaneGeometry;
  const params = geom.parameters;
  const hw = (params.width ?? 1) / 2;
  const hh = (params.height ?? 1) / 2;
  const sx = mesh.scale.x;
  const sy = mesh.scale.y;
  const corners = [
    [-hw * sx, -hh * sy],
    [hw * sx, -hh * sy],
    [hw * sx, hh * sy],
    [-hw * sx, hh * sy],
  ] as const;

  const rect = canvas.getBoundingClientRect();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [lx, ly] of corners) {
    _corner.set(lx, ly, 0);
    mesh.localToWorld(_corner);
    _corner.project(camera);
    const cx = rect.left + ((_corner.x + 1) / 2) * rect.width;
    const cy = rect.top + ((1 - _corner.y) / 2) * rect.height;
    minX = Math.min(minX, cx);
    minY = Math.min(minY, cy);
    maxX = Math.max(maxX, cx);
    maxY = Math.max(maxY, cy);
  }

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function runRaycastHitTest(
  raycaster: THREE.Raycaster,
  camera: THREE.PerspectiveCamera,
  canvas: HTMLCanvasElement,
  meshes: THREE.Object3D[],
  clientX: number,
  clientY: number,
): { candidates: HitTestCandidate[]; chosen: HitTestCandidate | null } {
  const rect = canvas.getBoundingClientRect();
  _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(_ndc, camera);

  const hits = raycaster
    .intersectObjects(meshes, false)
    .filter((h) => {
      const mesh = h.object as THREE.Mesh;
      if (!mesh.userData?.isImageCard) return false;
      const alpha = mesh.userData.currentAlpha ?? 1;
      return alpha >= HIT_TEST_MIN_ALPHA && mesh.visible;
    });

  const candidates: HitTestCandidate[] = hits.map((h) => {
    const mesh = h.object as THREE.Mesh;
    return {
      imageId: String(mesh.userData.imageId),
      distance: h.distance,
      alpha: mesh.userData.currentAlpha ?? 1,
      bounds: projectMeshClientBounds(mesh, camera, canvas),
    };
  });

  return { candidates, chosen: candidates[0] ?? null };
}
