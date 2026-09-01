interface BoxLogoProps {
  url: string | null;
  found: boolean;
}

/** Decorative only. Tap does not close overlay or return to AD_IDLE. */
export function BoxLogo({ url, found }: BoxLogoProps) {
  if (!found || !url) return null;
  return (
    <div className="box-logo" aria-hidden="true" onClick={(event) => event.stopPropagation()}>
      <img className="box-logo__image" src={url} alt="" draggable={false} />
    </div>
  );
}
