import type { HitTestDebugSnapshot } from '../three/hitTestDiagnostics';

interface HitTestDebugOverlayProps {
  enabled: boolean;
  snapshot: HitTestDebugSnapshot | null;
}

export function HitTestDebugOverlay({ enabled, snapshot }: HitTestDebugOverlayProps) {
  if (!enabled || !snapshot) return null;

  const crossSize = 14;
  const rejected =
    snapshot.wasTap && !snapshot.chosenImageId && snapshot.tapRejectedReason === 'noCandidate';

  return (
    <div className="hit-test-debug-layer" aria-hidden="true">
      <div
        className="hit-test-crosshair"
        style={{
          left: snapshot.clientX,
          top: snapshot.clientY,
          width: crossSize * 2,
          height: crossSize * 2,
          marginLeft: -crossSize,
          marginTop: -crossSize,
        }}
      />

      {snapshot.hitCandidates.map((c, i) => (
        <div
          key={`${c.imageId}-${i}`}
          className={`hit-test-bounds ${c.imageId === snapshot.chosenImageId ? 'chosen' : 'candidate'}`}
          style={{
            left: c.bounds.x,
            top: c.bounds.y,
            width: c.bounds.w,
            height: c.bounds.h,
          }}
        />
      ))}

      {rejected && (
        <div
          className="hit-test-reject-badge"
          style={{ left: snapshot.clientX + 16, top: snapshot.clientY + 16 }}
        >
          no hit
        </div>
      )}

      {!snapshot.wasTap && snapshot.tapRejectedReason !== 'none' && (
        <div
          className="hit-test-reject-badge"
          style={{ left: snapshot.clientX + 16, top: snapshot.clientY + 16 }}
        >
          {snapshot.tapRejectedReason}
        </div>
      )}
    </div>
  );
}
