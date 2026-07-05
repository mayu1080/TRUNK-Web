/**
 * DD Motion Pass — 探索・タップ・オーバーレイの挙動パラメータ（調整ハブ）
 *
 * Motion Pass 対応:
 *   A idle          … Pixi 探索画像の常時浮遊（ぷかぷか）
 *   B tapReaction   … タップ確定直後、選択画像の pre-ZOOM 反応
 *   C imageZoomOpen … DOM IMAGE_ZOOM（scrim + 白カード）の開閉
 *   D drawer        … categoryDrawer パネル + 背面 scrim
 *
 * 主な参照先:
 *   idle        → pixi/idleMotion.ts, pixi/exploreScene.ts
 *   tapReaction → pixi/touchReaction.ts, pixi/exploreController.ts
 *   imageZoomOpen → ui/ImageZoomOverlay.tsx, styles.css (--zoom-scrim-*)
 *   drawer      → ui/CategoryDrawer.tsx
 *   overlay     → 汎用 scrim 定数（SCRIM_MOTION — 現状 IMAGE_ZOOM 未使用）
 *
 * debug パネル左上「IMAGE_ZOOM timeline」も本ファイルの値を表示。
 */

export type EasingBezier = readonly [number, number, number, number];

/** drawer 等 — Framer Motion / Pixi 汎用 ease-out */
export const EASE_OUT_CUBIC: EasingBezier = [0.33, 1, 0.68, 1];

/**
 * easeInQuad — https://easings.net/ja#easeInQuad  f(x)=x²
 * CSS 近似: cubic-bezier(0.11, 0, 0.5, 0)
 * 序盤ゆっくり → 終盤加速
 */
export const EASE_IN_QUAD: EasingBezier = [0.11, 0, 0.5, 0];

/**
 * D: drawer 向け — easeInQuad 基準・傾きを抑えた languid 版
 * https://easings.net/ja#easeInQuad
 * P1x↑ P1y↓ で加速を弱め、全体的にゆっくり立ち上がる
 */
export const EASE_DRAWER_IN_QUAD: EasingBezier = [0.32, 0, 0.58, 0.02];

/**
 * easeInOutCubic — https://easings.net/ja#easeInOutCubic
 * CSS: cubic-bezier(0.645, 0.045, 0.355, 1)
 * 序盤・終盤ともに緩やか、中間で加速（対称型）
 */
export const EASE_IN_OUT_CUBIC: EasingBezier = [0.645, 0.045, 0.355, 1];

/** C: IMAGE_ZOOM `.zoom-backdrop` の opacity 0→1 に使用 */
export const EASE_IMAGE_ZOOM_SCRIM: EasingBezier = EASE_IN_OUT_CUBIC;

/** C: IMAGE_ZOOM `.zoom-card` の opacity 0→1（開く/閉じる）に使用 */
export const EASE_IMAGE_ZOOM_CARD: EasingBezier = EASE_IN_OUT_CUBIC;

/** @deprecated scrim/card 分離前の互換エイリアス */
export const EASE_IMAGE_ZOOM: EasingBezier = EASE_IMAGE_ZOOM_CARD;

/**
 * C: 白カード fade 開始までの待ち = React overlay マウント分
 * ImageZoomOverlay → transition.delay（秒換算）
 */
export const IMAGE_ZOOM_CARD_DELAY_FRAMES = 2;
export const IMAGE_ZOOM_CARD_DELAY_MS = Math.round(
  (1000 / 60) * IMAGE_ZOOM_CARD_DELAY_FRAMES,
);

/** A: far / mid / near レイヤごとの idle 振幅倍率 */
export interface IdleDepthProfile {
  /** Y 方向ドリフト倍率（layer ごと） */
  yAmp: number;
  /** X 方向ドリフト倍率 */
  xAmp: number;
  /** scale 呼吸倍率 */
  scaleAmp: number;
  /** 回転ドリフト倍率（deg ベース） */
  rotAmpDeg: number;
}

export interface MotionConfig {
  /** A — Pixi 探索層: 常時 idle 浮遊（旧 visualConfig.float の代替） */
  idle: {
    /** false で idle オフ（legacy float にフォールバック可） */
    enabled: boolean;
    /** 画像ごと intensity に応じた Y 振幅レンジ [px] */
    yAmplitudeMin: number;
    yAmplitudeMax: number;
    /** X 振幅レンジ [px] */
    xAmplitudeMin: number;
    xAmplitudeMax: number;
    /** scale 呼吸 amplitude レンジ（1 ± この値） */
    scaleAmplitudeMin: number;
    scaleAmplitudeMax: number;
    /** 回転 amplitude レンジ [deg] */
    rotationAmplitudeDegMin: number;
    rotationAmplitudeDegMax: number;
    /** sin 波の角速度レンジ（大きいほど速い） */
    speedMin: number;
    speedMax: number;
    /** true: 配置時に phase をランダム化（画像ごとに位相をずらす） */
    phaseRandom: boolean;
    /** far/mid/near レイヤ別の振幅スケール */
    depthProfile: Record<'far' | 'mid' | 'near', IdleDepthProfile>;
  };

  /**
   * B — タップ確定 → IMAGE_ZOOM 直前
   * exploreController.startTapFocus → touchReaction.animateTapFocus
   * await せず ZOOM と並行実行
   */
  tapReaction: {
    enabled: boolean;
    /** 明るさバンプの立ち上がり時間 [ms]（riseMs + holdMs で RAF 終了） */
    riseMs: number;
    /** ピーク維持時間 [ms]（0 = ZOOM へ即 handoff） */
    holdMs: number;
    /** 1 以外で scale バンプ（現状 1 = scale なし）→ sprite.scale */
    scaleTo: number;
    /** ColorMatrix brightness 加算量（1 + brighten が上限） */
    brighten: number;
    /** Pixi 側 RAF 補間（Framer ではない） */
    easing: 'easeOutCubic';
  };

  /**
   * C — IMAGE_ZOOM オープン
   * ImageZoomOverlay.tsx + styles.css
   *
   * タイムライン（tap 後）:
   *   tap bright（B, 並行）→ scrim fade → card delay → card fade
   */
  imageZoomOpen: {
    /** マスタースイッチ（false でも DOM は開く — 将来用） */
    enabled: boolean;
    /** `.zoom-backdrop` opacity 0→1 の duration [ms] */
    scrimFadeMs: number;
    /** `.zoom-card` fade 開始 delay [ms]（≈ React 2 frames） */
    cardDelayMs: number;
    /** `.zoom-card` opacity 0→1 の duration [ms]（開く） */
    cardFadeMs: number;
    /** scrim 背景色 rgba alpha（CSS `--zoom-scrim-max`） */
    scrimOpacityMax: number;
    /** backdrop-filter blur（CSS `--zoom-scrim-blur`） */
    scrimBlurPx: number;
    /** 白カード initial scale（1 = scale アニメなし） */
    cardScaleFrom: number;
    /** 白カード animate scale */
    cardScaleTo: number;
    /** 白カード initial translateY [px]（0 = スライドなし） */
    cardTranslateYFrom: number;
    /** 白カード exit translateY [px] */
    cardExitTranslateY: number;
    /** scrim の cubic-bezier → ImageZoomOverlay scrimTransition.ease */
    scrimEasing: EasingBezier;
    /** 白カードの cubic-bezier → cardOpenTransition / cardCloseTransition.ease */
    cardEasing: EasingBezier;
  };

  /**
   * D — categoryDrawer
   * CategoryDrawer.tsx → DRAWER_MOTION / DRAWER_SCRIM_MOTION
   */
  drawer: {
    /** `.drawer-panel` 幅 [px] */
    widthPx: number;
    /** パネル open: x/opacity アニメ duration [ms] */
    openMs: number;
    /** パネル close duration [ms] */
    closeMs: number;
    /** open 時の initial x オフセット [px]（右からスライド） */
    translateFromX: number;
    /** パネル initial opacity */
    opacityFrom: number;
    /** パネル animate opacity */
    opacityTo: number;
    /** `.drawer-scrim` fade duration [ms] */
    scrimFadeMs: number;
    /** パネル + drawer scrim — CategoryDrawer transition.ease（easeInQuad 系） */
    easing: EasingBezier;
    /** App 初期 state: drawer 背面 scrim 表示 */
    showScrimDefault: boolean;
  };

  /**
   * 汎用 scrim — SCRIM_MOTION エクスポート用
   * ※ IMAGE_ZOOM は imageZoomOpen.scrimFadeMs を直接使用
   */
  overlay: {
    scrimFadeMs: number;
    easing: EasingBezier;
  };
}

/** review / 55inch — 酔わない程度の微量ドリフト（周期長め・振幅やや大） */
export const MOTION_CONFIG: MotionConfig = {
  idle: {
    enabled: true,
    yAmplitudeMin: 5.0,
    yAmplitudeMax: 16.0,
    xAmplitudeMin: 0.5,
    xAmplitudeMax: 4.0,
    scaleAmplitudeMin: 0.012,
    scaleAmplitudeMax: 0.038,
    rotationAmplitudeDegMin: 0.15,
    rotationAmplitudeDegMax: 0.72,
    speedMin: 0.12,
    speedMax: 0.26,
    phaseRandom: true,
    depthProfile: {
      far: { yAmp: 1.2, xAmp: 0.3, scaleAmp: 0.004, rotAmpDeg: 0.08 },
      mid: { yAmp: 2.0, xAmp: 0.7, scaleAmp: 0.008, rotAmpDeg: 0.15 },
      near: { yAmp: 3.2, xAmp: 1.0, scaleAmp: 0.012, rotAmpDeg: 0.24 },
    },
  },
  tapReaction: {
    enabled: true,
    riseMs: 60,
    holdMs: 0,
    scaleTo: 1,
    brighten: 0.035,
    easing: 'easeOutCubic',
  },
  imageZoomOpen: {
    enabled: true,
    scrimFadeMs: 180,
    cardDelayMs: IMAGE_ZOOM_CARD_DELAY_MS,
    cardFadeMs: 210,
    scrimOpacityMax: 0.55,
    scrimBlurPx: 14,
    cardScaleFrom: 1,
    cardScaleTo: 1,
    cardTranslateYFrom: 0,
    cardExitTranslateY: 0,
    scrimEasing: EASE_IMAGE_ZOOM_SCRIM,
    cardEasing: EASE_IMAGE_ZOOM_CARD,
  },
  drawer: {
    widthPx: 320,
    openMs: 260,
    closeMs: 230,
    translateFromX: 12,
    opacityFrom: 0,
    opacityTo: 1,
    scrimFadeMs: 220,
    easing: EASE_DRAWER_IN_QUAD,
    showScrimDefault: true,
  },
  overlay: {
    scrimFadeMs: 140,
    easing: EASE_OUT_CUBIC,
  },
};

/**
 * C — Framer Motion 用 IMAGE_ZOOM 白カード keyframes
 * ImageZoomOverlay → motion.article initial / animate / exit
 * duration・delay は ImageZoomOverlay 側 transition で上書き
 */
export const IMAGE_ZOOM_MOTION = {
  durationMs: MOTION_CONFIG.imageZoomOpen.cardFadeMs,
  easing: MOTION_CONFIG.imageZoomOpen.cardEasing,
  initial: {
    opacity: 0,
    scale: MOTION_CONFIG.imageZoomOpen.cardScaleFrom,
    y: MOTION_CONFIG.imageZoomOpen.cardTranslateYFrom,
  },
  animate: {
    opacity: 1,
    scale: MOTION_CONFIG.imageZoomOpen.cardScaleTo,
    y: 0,
  },
  exit: {
    opacity: 0,
    scale: MOTION_CONFIG.imageZoomOpen.cardScaleTo,
    y: MOTION_CONFIG.imageZoomOpen.cardExitTranslateY,
  },
};

/**
 * D — Framer Motion 用 categoryDrawer パネル
 * CategoryDrawer → motion.aside
 */
export const DRAWER_MOTION = {
  widthPx: MOTION_CONFIG.drawer.widthPx,
  durationMs: MOTION_CONFIG.drawer.openMs,
  closeMs: MOTION_CONFIG.drawer.closeMs,
  easing: MOTION_CONFIG.drawer.easing,
  showScrimDefault: MOTION_CONFIG.drawer.showScrimDefault,
  initial: {
    x: MOTION_CONFIG.drawer.translateFromX,
    opacity: MOTION_CONFIG.drawer.opacityFrom,
  },
  animate: { x: 0, opacity: MOTION_CONFIG.drawer.opacityTo },
  exit: {
    x: MOTION_CONFIG.drawer.translateFromX * 0.6,
    opacity: MOTION_CONFIG.drawer.opacityFrom,
  },
};

/** 汎用 scrim keyframes（IMAGE_ZOOM 以外向け） */
export const SCRIM_MOTION = {
  durationMs: MOTION_CONFIG.overlay.scrimFadeMs,
  easing: MOTION_CONFIG.overlay.easing,
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

/**
 * D — Framer Motion 用 drawer 背面 scrim
 * CategoryDrawer → motion.button.drawer-scrim
 */
export const DRAWER_SCRIM_MOTION = {
  durationMs: MOTION_CONFIG.drawer.scrimFadeMs,
  easing: MOTION_CONFIG.drawer.easing,
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

/** C — IMAGE_ZOOM: 背景タップで閉じる（App.tsx 初期 state） */
export const CLOSE_ON_BACKDROP_DEFAULT = true;

export const MOCK_CATEGORIES = [
  { id: 'food', label: 'Food' },
  { id: 'gift', label: 'Gift' },
  { id: 'flower', label: 'Flower' },
] as const;

/** App / exploreController — 現在の UI オーバーレイ状態ラベル */
export type OverlayState = 'normal' | 'image-zoom-open' | 'drawer-open';

/** B — tapReaction RAF 補間（touchReaction.ts） */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
