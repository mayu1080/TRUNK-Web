import { DEMO_DISPLAY_NAME, DEMO_ID, DEMO_URL } from '../demoIdentity';

export function DemoBanner() {
  return (
    <header className="demo-banner">
      <strong>{DEMO_ID}</strong>
      <span className="demo-banner-sep">|</span>
      <span>{DEMO_DISPLAY_NAME}</span>
      <span className="demo-banner-sep">|</span>
      <span className="demo-banner-url">{DEMO_URL}</span>
    </header>
  );
}
