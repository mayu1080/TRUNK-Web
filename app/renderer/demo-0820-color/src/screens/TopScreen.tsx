interface TopScreenProps {
  onStart: () => void;
}

export function TopScreen({ onStart }: TopScreenProps) {
  return (
    <button type="button" className="screen-panel screen-panel--top" onClick={onStart}>
      <p className="screen-kicker">TOP</p>
      <p className="screen-title">Tap to start</p>
      <p className="screen-hint">placeholder · 0820 demo</p>
    </button>
  );
}
