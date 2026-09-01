import type { BrandFontCatalog } from './productionApi';

export interface BrandFontStatus {
  family: string;
  format: 'otf';
  fontLoaded: boolean;
  fontFallback: boolean;
  fontCheck: boolean;
  faces: string[];
  skipped: string[];
  warning: string | null;
}

const STYLE_ID = 'maison-neue-faces';
const FALLBACK: BrandFontStatus = {
  family: 'Maison Neue',
  format: 'otf',
  fontLoaded: false,
  fontFallback: true,
  fontCheck: false,
  faces: [],
  skipped: [],
  warning: 'Maison Neue missing / fallback',
};

function injectFontFaces(catalog: BrandFontCatalog): void {
  const existing = document.getElementById(STYLE_ID);
  if (existing) existing.remove();
  const css = catalog.faces
    .map(
      (face) => `@font-face {
  font-family: "${face.family}";
  src: url("${face.url}") format("opentype");
  font-weight: ${face.weight};
  font-style: ${face.style};
  font-display: swap;
}`,
    )
    .join('\n');
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

export async function loadMaisonNeue(): Promise<BrandFontStatus> {
  const api = window.trunkApi;
  if (!api?.getBrandFonts) {
    console.warn('[fonts] Maison Neue missing / fallback (getBrandFonts unavailable)');
    return { ...FALLBACK, warning: 'Maison Neue missing / fallback (getBrandFonts unavailable)' };
  }

  try {
    const catalog = await api.getBrandFonts();
    if (!catalog.faces.length) {
      const warning = catalog.warning || FALLBACK.warning;
      console.warn(`[fonts] ${warning}`);
      return {
        ...FALLBACK,
        skipped: catalog.skipped,
        warning,
      };
    }

    injectFontFaces(catalog);
    const loadResults = await Promise.all(
      catalog.faces.map((face) =>
        document.fonts
          .load(`${face.weight} 16px "${face.family}"`)
          .then((loaded) => loaded.length > 0)
          .catch((err) => {
            console.warn(`[fonts] face load failed ${face.fileName}`, err);
            return false;
          }),
      ),
    );
    await document.fonts.ready;
    const fontCheck = document.fonts.check('16px "Maison Neue"');
    const fontLoaded = fontCheck || loadResults.some(Boolean);
    if (!fontLoaded) {
      console.warn('[fonts] Maison Neue missing / fallback (document.fonts.check false)');
    }
    return {
      family: catalog.family,
      format: 'otf',
      fontLoaded,
      fontFallback: !fontLoaded,
      fontCheck,
      faces: catalog.faces.map((face) => `${face.fileName}:${face.weight}${face.style === 'italic' ? 'i' : ''}`),
      skipped: catalog.skipped,
      warning: catalog.warning,
    };
  } catch (err) {
    console.warn('[fonts] Maison Neue missing / fallback', err);
    return {
      ...FALLBACK,
      warning: err instanceof Error ? err.message : String(err),
    };
  }
}
