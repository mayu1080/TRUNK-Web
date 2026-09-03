import type { UiDisplayMode } from '../uiMode';
import {
  BUBBLE_MOTION_PRESETS,
  DOLLY_FEEL_PRESETS,
  PIXEL_RATIO_CAPS,
  VISUAL_PRESETS,
  matchDollyFeel,
  type BubbleMotionId,
  type DollyFeelId,
  type PixelRatioCap,
  type VisualPresetId,
} from '../runtimeConfig';

interface DemoTogglesProps {
  presetId: VisualPresetId;
  onPresetChange: (id: VisualPresetId) => void;
  bubbleMotionId: BubbleMotionId;
  onBubbleMotionChange: (id: BubbleMotionId) => void;
  uiMode: UiDisplayMode;
  onUiModeChange: (mode: UiDisplayMode) => void;
  pixelRatioCap: PixelRatioCap;
  onPixelRatioCapChange: (v: PixelRatioCap) => void;
  bubbleSizePx: number;
  onBubbleSizeChange: (v: number) => void;
  revealRadiusPx: number;
  onRevealRadiusChange: (v: number) => void;
  listMotionSpeed: number;
  onListMotionSpeedChange: (v: number) => void;
  cameraDollySpeed: number;
  onCameraDollySpeedChange: (v: number) => void;
  dollyCruiseEnabled: boolean;
  onDollyCruiseEnabledChange: (v: boolean) => void;
  dollyPoseSmoothing: number;
  onDollyPoseSmoothingChange: (v: number) => void;
  pinchDollyScale: number;
  onPinchDollyScaleChange: (v: number) => void;
  onDollyFeelChange: (id: DollyFeelId) => void;
  fps: number | null;
}

const PRESET_IDS = Object.keys(VISUAL_PRESETS) as VisualPresetId[];
const BUBBLE_MOTION_IDS = Object.keys(BUBBLE_MOTION_PRESETS) as BubbleMotionId[];
const DOLLY_FEEL_IDS = Object.keys(DOLLY_FEEL_PRESETS) as DollyFeelId[];

function NumberSelect({
  value,
  options,
  onChange,
  format,
}: {
  value: number;
  options: number[];
  onChange: (v: number) => void;
  format?: (n: number) => string;
}) {
  const opts = options.includes(value) ? options : [...options, value].sort((a, b) => a - b);
  return (
    <select
      value={String(value)}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
    >
      {opts.map((v) => (
        <option key={v} value={String(v)}>
          {format ? format(v) : String(v)}
        </option>
      ))}
    </select>
  );
}

export function DemoToggles({
  presetId,
  onPresetChange,
  bubbleMotionId,
  onBubbleMotionChange,
  uiMode,
  onUiModeChange,
  pixelRatioCap,
  onPixelRatioCapChange,
  bubbleSizePx,
  onBubbleSizeChange,
  revealRadiusPx,
  onRevealRadiusChange,
  listMotionSpeed,
  onListMotionSpeedChange,
  cameraDollySpeed,
  onCameraDollySpeedChange,
  dollyCruiseEnabled,
  onDollyCruiseEnabledChange,
  dollyPoseSmoothing,
  onDollyPoseSmoothingChange,
  pinchDollyScale,
  onPinchDollyScaleChange,
  onDollyFeelChange,
  fps,
}: DemoTogglesProps) {
  const visual = VISUAL_PRESETS[presetId] ?? VISUAL_PRESETS['soft-tint'];
  const bubbleMotion = BUBBLE_MOTION_PRESETS[bubbleMotionId] ?? BUBBLE_MOTION_PRESETS.elegant;
  const dollyFeel = matchDollyFeel(cameraDollySpeed, dollyPoseSmoothing, pinchDollyScale);

  return (
    <div className="demo-toggles">
      <p className="demo-toggles-hint">G/D: debug · R: review</p>
      <p className="demo-toggles-hint">
        FPS {fps != null && Number.isFinite(fps) ? fps.toFixed(1) : '—'}
      </p>
      <label>
        visual preset
        <select
          value={presetId}
          onChange={(e) => onPresetChange(e.target.value as VisualPresetId)}
          title={visual.description}
        >
          {PRESET_IDS.map((id) => (
            <option key={id} value={id} title={VISUAL_PRESETS[id].description}>
              {id}
            </option>
          ))}
        </select>
      </label>
      <label>
        bubble motion
        <select
          value={bubbleMotionId}
          onChange={(e) => onBubbleMotionChange(e.target.value as BubbleMotionId)}
          title={bubbleMotion.description}
        >
          {BUBBLE_MOTION_IDS.map((id) => (
            <option key={id} value={id} title={BUBBLE_MOTION_PRESETS[id].description}>
              {BUBBLE_MOTION_PRESETS[id].label}
            </option>
          ))}
        </select>
      </label>
      <label>
        ui mode
        <select value={uiMode} onChange={(e) => onUiModeChange(e.target.value as UiDisplayMode)}>
          <option value="review">review</option>
          <option value="debug">debug</option>
        </select>
      </label>
      <label>
        pixel ratio cap
        <select
          value={String(pixelRatioCap)}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (n === 1 || n === 1.5 || n === 2) onPixelRatioCapChange(n);
          }}
        >
          {PIXEL_RATIO_CAPS.map((v) => (
            <option key={v} value={v}>
              {v.toFixed(1)}
            </option>
          ))}
        </select>
      </label>
      <label>
        bubble size
        <NumberSelect value={bubbleSizePx} options={[160, 240, 320, 400, 480]} onChange={onBubbleSizeChange} />
      </label>
      <label>
        reveal radius
        <NumberSelect value={revealRadiusPx} options={[120, 160, 200, 260]} onChange={onRevealRadiusChange} />
      </label>
      <label>
        list speed
        <NumberSelect
          value={listMotionSpeed}
          options={[0.5, 1, 1.6, 2.4]}
          onChange={onListMotionSpeedChange}
          format={(n) => n.toFixed(1)}
        />
      </label>
      <label>
        dolly cruise
        <select
          value={dollyCruiseEnabled ? 'on' : 'off'}
          onChange={(e) => onDollyCruiseEnabledChange(e.target.value === 'on')}
        >
          <option value="on">on</option>
          <option value="off">off</option>
        </select>
      </label>
      <label>
        dolly feel
        <select
          value={dollyFeel}
          onChange={(e) => {
            const id = e.target.value as DollyFeelId;
            if (id in DOLLY_FEEL_PRESETS) onDollyFeelChange(id);
          }}
          title="speed / smoothing / pinch をセットで切替"
        >
          {DOLLY_FEEL_IDS.map((id) => (
            <option key={id} value={id}>
              {DOLLY_FEEL_PRESETS[id].label}
            </option>
          ))}
          {dollyFeel === 'custom' ? <option value="custom">custom</option> : null}
        </select>
      </label>
      <label>
        dolly speed
        <NumberSelect
          value={cameraDollySpeed}
          options={[0.5, 1, 1.8, 2.6]}
          onChange={onCameraDollySpeedChange}
          format={(n) => n.toFixed(1)}
        />
      </label>
      <label>
        dolly smoothing
        <NumberSelect
          value={dollyPoseSmoothing}
          options={[0.12, 0.2, 0.32, 0.45]}
          onChange={onDollyPoseSmoothingChange}
          format={(n) => n.toFixed(2)}
        />
      </label>
      <label>
        pinch sensitivity
        <NumberSelect
          value={pinchDollyScale}
          options={[0.6, 1, 1.6, 2.4]}
          onChange={onPinchDollyScaleChange}
          format={(n) => n.toFixed(1)}
        />
      </label>
    </div>
  );
}
