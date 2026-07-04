/** デモ用ターゲット枚数（負荷検証） */
export const TARGET_IMAGE_COUNT = 40;
export const MAX_IMAGE_COUNT = 70;

/** 探索ワールド仮想サイズ（visualConfig.world と同期） */
export const WORLD_WIDTH = 3000;
export const WORLD_HEIGHT = 2200;

/** 配置時のワールド端マージン（visualConfig.world.margin と同期） */
export const WORLD_MARGIN = 88;

/** パン慣性（デバッグ調整用） */
export const INERTIA_FRICTION = 0.9;
export const INERTIA_MIN_VELOCITY = 0.4;

/** タップ判定（CSS px — キオスクの指ブレを許容） */
export const TAP_MOVE_THRESHOLD_PX = 16;
export const TAP_MAX_DURATION_MS = 500;

/** この距離未満はパン開始しない（タップ誤判定・微パン防止） */
export const PAN_START_THRESHOLD_PX = 14;

/** LIST 探索に使わない content/images トップレベルフォルダ */
export const EXCLUDED_LIST_SOURCE_FOLDERS = ['cm'] as const;

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
