/** 画面上部 — DB デモと混同しないための常時表示バナー */
export function DemoBanner() {
  return (
    <header className="demo-banner" aria-hidden="false">
      <strong>DA</strong>
      <span className="demo-banner-sep">|</span>
      <span>DOM + Motion UI</span>
      <span className="demo-banner-sep">|</span>
      <span className="demo-banner-url">http://localhost:5174</span>
    </header>
  );
}
