import { useEffect, useState } from 'react';

export interface LogoAssetStatus {
  found: boolean;
  fileName: string | null;
  url: string | null;
  logoRoot: string;
  scheme: string | null;
}

interface ListLogoProps {
  onStatus?: (status: LogoAssetStatus) => void;
}

export function ListLogo({ onStatus }: ListLogoProps) {
  const [asset, setAsset] = useState<LogoAssetStatus | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const api = window.trunkApi;
    if (!api?.getLogoAsset) {
      const missing: LogoAssetStatus = {
        found: false,
        fileName: null,
        url: null,
        logoRoot: '(unavailable)',
        scheme: null,
      };
      console.warn('[0820] logo skipped: getLogoAsset is not available');
      void api?.logEvent?.({
        level: 'warn',
        message: '0820 logo skipped: getLogoAsset is not available',
      });
      onStatus?.(missing);
      return;
    }

    void api
      .getLogoAsset()
      .then((result) => {
        if (cancelled) return;
        const scheme = result.url ? new URL(result.url).protocol.replace(':', '') : null;
        const status: LogoAssetStatus = {
          found: result.found,
          fileName: result.fileName,
          url: result.url,
          logoRoot: result.logoRoot,
          scheme,
        };
        setAsset(status);
        onStatus?.(status);
        if (!result.found) {
          console.warn('[0820] logo not found in Logo/', { logoRoot: result.logoRoot });
          void api.logEvent({
            level: 'warn',
            message: '0820 logo not found',
            context: { logoRoot: result.logoRoot },
          });
        } else {
          console.info('[0820] logo', {
            fileName: result.fileName,
            scheme,
            logoRoot: result.logoRoot,
          });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const failed: LogoAssetStatus = {
          found: false,
          fileName: null,
          url: null,
          logoRoot: '(error)',
          scheme: null,
        };
        setAsset(failed);
        onStatus?.(failed);
        console.warn('[0820] logo load failed', err);
      });

    return () => {
      cancelled = true;
    };
  }, [onStatus]);

  if (!asset?.found || !asset.url || imgFailed) return null;

  return (
    <div className="logo-plate" aria-hidden="true">
      <img
        className="logo-plate__image"
        src={asset.url}
        alt=""
        draggable={false}
        onError={() => {
          setImgFailed(true);
          console.warn('[0820] logo image failed to display', { fileName: asset.fileName });
        }}
      />
    </div>
  );
}
