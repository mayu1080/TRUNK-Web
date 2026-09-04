interface TouchMarkerProps {
  monitorId: number;
  clientX: number;
  clientY: number;
}

/** Debug-only local hit marker. Distinct from Bubble. Hidden when debug mode is off. */
export function TouchMarker({ monitorId, clientX, clientY }: TouchMarkerProps) {
  return (
    <div
      className="touch-marker touch-marker--debug"
      data-touch-marker="debug"
      data-touch-monitor-id={monitorId}
      style={{ left: clientX, top: clientY }}
      aria-hidden="true"
    >
      {`M${monitorId} TOUCH`}
    </div>
  );
}
