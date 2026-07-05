import { useEffect, useState } from 'react';
import type { VisualConfig } from '../visualConfig';
import { resolveNoiseTextureUrl } from './noiseTexture';
import type { TonePresetId, VisualPresetId } from '../visualConfig';
import { TONE_PRESET_IDS, TONE_PRESETS } from '../visualConfig';

interface NoiseOverlayProps {
  config: VisualConfig;
}

/**
 * Turbulence grain — Pixi 探索画像の直上（z-index 12）
 * 本番は public/textures/noise-turbulence.png 等のタイル素材を推奨
 */
export function NoiseOverlay({ config }: NoiseOverlayProps) {
  const { background } = config;
  const [texture, setTexture] = useState<{
    url: string;
    source: 'asset' | 'procedural';
  } | null>(null);

  useEffect(() => {
    if (!background.noiseEnabled) {
      setTexture(null);
      return;
    }

    let cancelled = false;
    void resolveNoiseTextureUrl(background.noiseTextureUrl, background.noiseTileSize).then(
      (resolved) => {
        if (!cancelled) setTexture(resolved);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [background.noiseEnabled, background.noiseTextureUrl, background.noiseTileSize]);

  if (!background.noiseEnabled || !texture) return null;

  const tile = background.noiseTileSize;
  const tileStyle = {
    backgroundImage: `url(${texture.url})`,
    backgroundSize: `${tile}px ${tile}px`,
  };

  return (
    <div
      className="noise-overlay"
      style={{
        opacity: background.noiseOpacity,
        mixBlendMode: background.noiseBlendMode,
      }}
      data-noise-source={texture.source}
      aria-hidden="true"
    >
      <div className="noise-overlay__tile noise-overlay__tile--a" style={tileStyle} />
      <div className="noise-overlay__tile noise-overlay__tile--b" style={tileStyle} />
    </div>
  );
}

import type { UiDisplayMode } from '../uiMode';

interface VisualTogglesProps {
  presetId: VisualPresetId;
  onPresetChange: (id: VisualPresetId) => void;
  tonePresetId: TonePresetId;
  onTonePresetChange: (id: TonePresetId) => void;
  closeOnBackdrop: boolean;
  onCloseOnBackdropChange: (v: boolean) => void;
  showDrawerScrim: boolean;
  onDrawerScrimChange: (v: boolean) => void;
  hitTestDebug: boolean;
  onHitTestDebugChange: (v: boolean) => void;
  uiMode: UiDisplayMode;
  onUiModeChange: (mode: UiDisplayMode) => void;
}

export function VisualToggles({
  presetId,
  onPresetChange,
  tonePresetId,
  onTonePresetChange,
  closeOnBackdrop,
  onCloseOnBackdropChange,
  showDrawerScrim,
  onDrawerScrimChange,
  hitTestDebug,
  onHitTestDebugChange,
  uiMode,
  onUiModeChange,
}: VisualTogglesProps) {
  return (
    <div className="demo-toggles">
      <p className="demo-toggles-hint">G/D: debug · R: review</p>
      <label>
        visual preset
        <select
          value={presetId}
          onChange={(e) => onPresetChange(e.target.value as VisualPresetId)}
        >
          <option value="clean">clean</option>
          <option value="cultish-soft">cultish-soft</option>
          <option value="cultish-heavy">cultish-heavy</option>
        </select>
      </label>
      <label>
        tone preset
        <select
          value={tonePresetId}
          onChange={(e) => onTonePresetChange(e.target.value as TonePresetId)}
          title={TONE_PRESETS[tonePresetId].description}
        >
          {TONE_PRESET_IDS.map((id) => (
            <option key={id} value={id} title={TONE_PRESETS[id].description}>
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
