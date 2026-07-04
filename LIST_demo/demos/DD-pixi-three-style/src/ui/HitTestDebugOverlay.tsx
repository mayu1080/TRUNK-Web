import type { HitTestDebugSnapshot } from '../pixi/hitTestDiagnostics';
import { mapRendererToClient } from '../pixi/pointerCoords';

interface HitTestDebugOverlayProps {
  enabled: boolean;
  canvas: HTMLCanvasElement | null;
  snapshot: HitTestDebugSnapshot | null;
}

export function HitTestDebugOverlay({
  enabled,
  canvas,
  snapshot,
}: HitTestDebugOverlayProps) {
  if (!enabled || !canvas || !snapshot) return null;

  const upClient = mapRendererToClient(canvas, snapshot.canvasUp.x, snapshot.canvasUp.y);
  const crossSize = 14;

  const candidateRects = snapshot.hitCandidates.map((c, i) => {
    const tl = mapRendererToClient(canvas, c.bounds.x, c.bounds.y);
    const br = mapRendererToClient(
      canvas,
      c.bounds.x + c.bounds.w,
      c.bounds.y + c.bounds.h,
    );
    return {
      key: `${c.imageId}-${i}`,
      left: tl.x,
      top: tl.y,
      width: br.x - tl.x,
      height: br.y - tl.y,
      isChosen: c.imageId === snapshot.chosenImageId,
    };
  });

  const rejected =
    snapshot.wasTap && !snapshot.chosenImageId && snapshot.tapRejectedReason === 'noCandidate';

  return (
    <div className="hit-test-debug-layer" aria-hidden="true">
      <div
        className="hit-test-crosshair"
        style={{
          left: upClient.x,
          top: upClient.y,
          width: crossSize * 2,
          height: crossSize * 2,
          marginLeft: -crossSize,
          marginTop: -crossSize,
        }}
      />

      {candidateRects.map((r) => (
        <div
          key={r.key}
          className={`hit-test-bounds ${r.isChosen ? 'chosen' : 'candidate'}`}
          style={{
            left: r.left,
            top: r.top,
            width: r.width,
            height: r.height,
          }}
        />
      ))}

      {rejected && (
        <div
          className="hit-test-reject-badge"
          style={{ left: upClient.x + 16, top: upClient.y + 16 }}
        >
          no hit
        </div>
      )}

      {!snapshot.wasTap && snapshot.tapRejectedReason !== 'none' && (
        <div
          className="hit-test-reject-badge"
          style={{ left: upClient.x + 16, top: upClient.y + 16 }}
        >
          {snapshot.tapRejectedReason}
        </div>
      )}
    </div>
  );
}
