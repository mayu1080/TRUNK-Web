/** デモ用ターゲット枚数（負荷検証） */
export const TARGET_IMAGE_COUNT = 40;
export const MAX_IMAGE_COUNT = 70;

/** 探索ワールド仮想サイズ（表示サイズ正規化後の LIST 空間） */
export const WORLD_WIDTH = 3200;
export const WORLD_HEIGHT = 2400;

/** 配置時のワールド端マージン */
export const WORLD_MARGIN = 80;

/** パン慣性（デバッグ調整用） */
export const INERTIA_FRICTION = 0.9;
export const INERTIA_MIN_VELOCITY = 0.4;

/** タップ判定 */
export const TAP_MOVE_THRESHOLD_PX = 12;
export const TAP_MAX_DURATION_MS = 350;

/** ズーム */
export const MIN_ZOOM = 0.35;
export const MAX_ZOOM = 2.5;

/** content/ 内の既知サンプル（mock 用） */
export const MOCK_SOURCE_PATHS = [
  'images/list/sample_list_01.svg',
  'images/list/sample_list_02.svg',
  'images/food/sample_food_01.svg',
  'images/gift/sample_gift_01.svg',
] as const;
