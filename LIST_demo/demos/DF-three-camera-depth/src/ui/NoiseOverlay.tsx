import { useEffect, useState } from 'react';
import type { DfVisualConfig } from '../visualConfig';
import { resolveNoiseTextureUrl } from './noiseTexture';

interface NoiseOverlayProps {
  config: DfVisualConfig;
}

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
