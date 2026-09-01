import { DEMO_ID, DEMO_URL } from '../demoIdentity';

export function DemoBanner() {
  return (
    <header className="demo-banner">
      <strong>{DEMO_ID}</strong>
      <span className="demo-banner-sep">|</span>
      <span>Three.js Camera Depth</span>
      <span className="demo-banner-sep">|</span>
      <span className="demo-banner-url">{DEMO_URL}</span>
    </header>
  );
}
