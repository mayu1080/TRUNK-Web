/** Motion / layout 定数（調整用） */

export const IMAGE_ZOOM_MOTION = {
  durationMs: 220,
  /** framer-motion cubic-bezier */
  easing: [0.16, 1, 0.3, 1] as const,
  initial: { opacity: 0, scale: 0.96, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96, y: 8 },
};

export const DRAWER_MOTION = {
  widthPx: 360,
  durationMs: 280,
  easing: [0.32, 0.72, 0, 1] as const,
  /** scrim（背面薄暗幕）を表示するか — App 側で切替可 */
  showScrimDefault: true,
  initial: { x: '100%' as const, opacity: 0.8 },
  animate: { x: 0, opacity: 1 },
  exit: { x: '100%' as const, opacity: 0.8 },
};

export const SCRIM_MOTION = {
  durationMs: 200,
  easing: 'easeOut' as const,
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

/** タッチターゲット最小サイズ */
export const TOUCH_MIN_PX = 48;
export const TOUCH_PREFERRED_PX = 56;

/** overlay 外クリックで閉じる（デモ設定・切替可） */
export const CLOSE_ON_BACKDROP_DEFAULT = false;

export const MOCK_CATEGORIES = [
  { id: 'food', label: 'FOOD' },
  { id: 'gift', label: 'GIFT' },
  { id: 'flower', label: 'FLOWER' },
  { id: 'cm', label: 'CM' },
] as const;

export interface MockCard {
  id: string;
  label: string;
  w: number;
  h: number;
  imageUrl: string;
}

/** demo-asset-index 未読込時のフォールバック（content サンプル SVG） */
export const FALLBACK_MOCK_CARDS: MockCard[] = [
  {
    id: 'food/sample_food_01',
    label: 'Food A',
    w: 140,
    h: 100,
    imageUrl: '/content/images/food/sample_food_01.svg',
  },
  {
    id: 'food/sample_food_01',
    label: 'Food B',
    w: 120,
    h: 160,
    imageUrl: '/content/images/food/sample_food_01.svg',
  },
  {
    id: 'gift/sample_gift_01',
    label: 'Gift A',
    w: 160,
    h: 110,
    imageUrl: '/content/images/gift/sample_gift_01.svg',
  },
  {
    id: 'flower/sample',
    label: 'Flower',
    w: 130,
    h: 130,
    imageUrl: '/content/images/food/sample_food_01.svg',
  },
  {
    id: 'list/sample_list_01',
    label: 'List Card',
    w: 150,
    h: 90,
    imageUrl: '/content/images/list/sample_list_01.svg',
  },
  {
    id: 'cm/sample',
    label: 'CM Prev',
    w: 110,
    h: 140,
    imageUrl: '/content/images/food/sample_food_01.svg',
  },
];

/** @deprecated use FALLBACK_MOCK_CARDS or useDemoCards() */
export const MOCK_CARDS = FALLBACK_MOCK_CARDS;
