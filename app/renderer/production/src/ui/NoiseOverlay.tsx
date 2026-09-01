import { useEffect, useMemo, useState } from 'react';
import { listConfig } from '../listConfig';
import type { NoiseAssetInfo } from '../productionApi';
import { createProceduralNoiseTile } from './noiseTexture';

interface NoiseOverlayProps {
  apply: boolean;
}

/** content/noise mp4 when present; procedural grain fallback. pointer-events none. */
export function NoiseOverlay({ apply }: NoiseOverlayProps) {
  const [asset, setAsset] = useState<NoiseAssetInfo | null>(null);
  const fallbackUrl = useMemo(
    () => (listConfig.noiseEnabled ? createProceduralNoiseTile(listConfig.noiseTileSize) : ''),
    [],
  );

  useEffect(() => {
    if (!listConfig.noiseEnabled || !window.trunkApi?.getNoiseAsset) return;
    let cancelled = false;
    void window.trunkApi.getNoiseAsset().then((next) => {
      if (!cancelled) setAsset(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!listConfig.noiseEnabled || !apply) return null;

  const useVideo = Boolean(asset?.found && asset.url);
  const tile = `${listConfig.noiseTileSize}px ${listConfig.noiseTileSize}px`;

  return (
    <div
      className="noise-overlay"
      data-noise-source={useVideo ? 'mp4' : 'fallback-dom'}
      style={{
        opacity: listConfig.noiseOpacity,
        mixBlendMode: listConfig.noiseBlendMode,
      }}
      aria-hidden="true"
    >
      {useVideo ? (
        <video
          className="noise-overlay__video"
          src={asset!.url!}
          autoPlay
          loop
          muted
          playsInline
        />
      ) : fallbackUrl ? (
        <>
          <div
            className="noise-overlay__tile noise-overlay__tile--a"
            style={{ backgroundImage: `url(${fallbackUrl})`, backgroundSize: tile }}
          />
          <div
            className="noise-overlay__tile noise-overlay__tile--b"
            style={{ backgroundImage: `url(${fallbackUrl})`, backgroundSize: tile }}
          />
        </>
      ) : null}
    </div>
  );
}

export function noiseDebugLine(asset: NoiseAssetInfo | null): string {
  if (!listConfig.noiseEnabled) return 'noise: off';
  if (asset?.found && asset.fileName) {
    return `noise: mp4 ${asset.fileName} opacity=${listConfig.noiseOpacity}`;
  }
  return `noise: fallback-dom opacity=${listConfig.noiseOpacity}${asset?.warning ? ` (${asset.warning})` : ''}`;
}
