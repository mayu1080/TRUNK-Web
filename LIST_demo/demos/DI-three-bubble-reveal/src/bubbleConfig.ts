/** Bubble Color Reveal — DI 推奨 config（screen px 基準） */

export type RevealMode = 'shader' | 'dual-plane' | 'raycaster';

/** Debug プルダウン用 — 縁ライン Motion */
export type BubbleMotionId = 'off' | 'elegant';

export const BUBBLE_MOTION_PRESETS: Record<
  BubbleMotionId,
  { id: BubbleMotionId; label: string; description: string }
> = {
  off: {
    id: 'off',
    label: 'motion off',
    description: '静的な一重円（細い白ラインのみ）',
  },
  elegant: {
    id: 'elegant',
    label: 'elegant (A+B)',
    description: '呼吸 + 対岸2点の楕円 glint 周回（微量 dust）',
  },
};

export const DEFAULT_BUBBLE_MOTION: BubbleMotionId = 'elegant';

export interface BubbleConfig {
  enabled: boolean;
  sizePx: number;
  revealRadiusPx: number;
  offsetX: number;
  offsetY: number;
  /** 0 = 即時、大きいほど滑らか（毎フレーム lerp 係数） */
  followSmoothing: number;
  hideDelayMs: number;
  showOnPointerMove: boolean;
  activeOnlyInList: boolean;
  /** DI 初回は shader 固定 */
  revealMode: RevealMode;
}

export const DEFAULT_BUBBLE_CONFIG: BubbleConfig = {
  enabled: true,
  /** 55インチ縦キオスク向け — 指周辺の色復帰が読みやすい径 */
  sizePx: 320,
  /** UI 直径と一致（縁ライン内側でハードに色復帰） */
  revealRadiusPx: 160,
  offsetX: 0,
  offsetY: 0,
  followSmoothing: 0.18,
  hideDelayMs: 600,
  showOnPointerMove: true,
  activeOnlyInList: true,
  revealMode: 'shader',
};

export interface BubbleRuntimeState {
  enabled: boolean;
  visible: boolean;
  allowed: boolean;
  screenX: number;
  screenY: number;
  sizePx: number;
  revealRadiusPx: number;
  revealMode: RevealMode;
  pointerType: string;
  imageZoomOpen: boolean;
  drawerOpen: boolean;
  revealCenterNdcX: number;
  revealCenterNdcY: number;
  revealActive: boolean;
}
