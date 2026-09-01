/** CategoryDrawer motion / copy。
 * 幅は 2026-08-19 指摘で 320px 固定から画面横幅 1/3 に変更（本番にも反映）。
 */

export type EasingBezier = readonly [number, number, number, number];

export const EASE_DRAWER_IN_QUAD: EasingBezier = [0.32, 0, 0.58, 0.02];

export const DRAWER_MOTION = {
  /** Frozen は 320px。指摘により CSS `--drawer-width: calc(100vw / 3)` を使う。 */
  widthPxFrozen: 320,
  widthCss: 'calc(100vw / 3)',
  durationMs: 260,
  closeMs: 230,
  easing: EASE_DRAWER_IN_QUAD,
  showScrimDefault: true,
  initial: { x: 12, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: 7.2, opacity: 0 },
} as const;

export const DRAWER_SCRIM_MOTION = {
  durationMs: 220,
  easing: EASE_DRAWER_IN_QUAD,
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
} as const;

export const MOCK_CATEGORIES = [
  { id: 'food', label: 'Food' },
  { id: 'gift', label: 'Gift' },
  { id: 'flower', label: 'Flower' },
] as const;

export type DrawerCategoryId = (typeof MOCK_CATEGORIES)[number]['id'];

export function labelForCategoryId(id: string | null | undefined): string | null {
  if (!id) return null;
  return MOCK_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
