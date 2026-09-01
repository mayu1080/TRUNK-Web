import { DEMO_ID, DEMO_URL } from '../demoIdentity';

export function DemoBanner() {
  const label =
    DEMO_ID === 'DE'
      ? 'Camera Depth Navigation (E-2)'
      : 'Pixi + Three風 + DOM + Motion (E object-flow)';

  return (
    <header className="demo-banner">
      <strong>{DEMO_ID}</strong>
      <span className="demo-banner-sep">|</span>
      <span>{label}</span>
      <span className="demo-banner-sep">|</span>
      <span className="demo-banner-url">{DEMO_URL}</span>
    </header>
  );
}
