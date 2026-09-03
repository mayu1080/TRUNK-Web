interface HamburgerButtonProps {
  mode: 'bars' | 'close';
  onClick: () => void;
}

export function HamburgerButton({ mode, onClick }: HamburgerButtonProps) {
  return (
    <button
      type="button"
      className="hamburger"
      aria-label={mode === 'close' ? 'Close menu' : 'Open menu'}
      onClick={onClick}
    >
      {mode === 'close' ? (
        <span className="hamburger-close-mark" aria-hidden="true">
          ×
        </span>
      ) : (
        <>
          <span className="hamburger-bar" />
          <span className="hamburger-bar" />
          <span className="hamburger-bar" />
        </>
      )}
    </button>
  );
}
