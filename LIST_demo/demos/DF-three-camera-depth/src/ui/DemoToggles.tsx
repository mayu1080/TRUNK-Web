import type { VisualPresetId } from '../visualConfig';
import { VISUAL_PRESETS } from '../visualConfig';
import type { UiDisplayMode } from '../uiMode';

interface DemoTogglesProps {
  presetId: VisualPresetId;
  onPresetChange: (id: VisualPresetId) => void;
  hitTestDebug: boolean;
  onHitTestDebugChange: (v: boolean) => void;
  closeOnBackdrop: boolean;
  onCloseOnBackdropChange: (v: boolean) => void;
  showDrawerScrim: boolean;
  onDrawerScrimChange: (v: boolean) => void;
  uiMode: UiDisplayMode;
  onUiModeChange: (mode: UiDisplayMode) => void;
}

const PRESET_IDS = Object.keys(VISUAL_PRESETS) as VisualPresetId[];

export function DemoToggles({
  presetId,
  onPresetChange,
  hitTestDebug,
  onHitTestDebugChange,
  closeOnBackdrop,
  onCloseOnBackdropChange,
  showDrawerScrim,
  onDrawerScrimChange,
  uiMode,
  onUiModeChange,
}: DemoTogglesProps) {
  return (
    <div className="demo-toggles">
      <p className="demo-toggles-hint">G/D: debug · R: review</p>
      <label>
        visual preset
        <select
          value={presetId}
          onChange={(e) => onPresetChange(e.target.value as VisualPresetId)}
          title={VISUAL_PRESETS[presetId].description}
        >
          {PRESET_IDS.map((id) => (
            <option key={id} value={id} title={VISUAL_PRESETS[id].description}>
              {id}
            </option>
          ))}
        </select>
      </label>
      <label>
        ui mode
        <select
          value={uiMode}
          onChange={(e) => onUiModeChange(e.target.value as UiDisplayMode)}
        >
          <option value="review">review</option>
          <option value="debug">debug</option>
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={hitTestDebug}
          onChange={(e) => onHitTestDebugChange(e.target.checked)}
        />
        Hit test debug
      </label>
      <label>
        <input
          type="checkbox"
          checked={closeOnBackdrop}
          onChange={(e) => onCloseOnBackdropChange(e.target.checked)}
        />
        ZOOM: close on backdrop
      </label>
      <label>
        <input
          type="checkbox"
          checked={showDrawerScrim}
          onChange={(e) => onDrawerScrimChange(e.target.checked)}
        />
        Drawer scrim
      </label>
    </div>
  );
}
