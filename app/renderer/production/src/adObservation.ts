/** Observation-only ad timing. Does not change play / seek / src assignment. */

export function observeAdEvent(event: string, fields: Record<string, unknown>): void {
  window.trunkApi?.appendObservation?.({
    source: 'renderer',
    decision: 'INFO',
    event,
    ...fields,
  });
}

export function observedPlay(el: HTMLVideoElement, fields: Record<string, unknown>): Promise<void> {
  observeAdEvent('VIDEO_PLAY_CALLED', {
    ...fields,
    currentTime: Number.isFinite(el.currentTime) ? el.currentTime : null,
    paused: el.paused,
    readyState: el.readyState,
  });
  return el.play().then(
    () => {
      observeAdEvent('VIDEO_PLAY_RESOLVED', {
        ...fields,
        ok: true,
        currentTime: Number.isFinite(el.currentTime) ? el.currentTime : null,
        readyState: el.readyState,
      });
    },
    (err: unknown) => {
      observeAdEvent('VIDEO_PLAY_RESOLVED', {
        ...fields,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        currentTime: Number.isFinite(el.currentTime) ? el.currentTime : null,
        readyState: el.readyState,
      });
      throw err;
    },
  );
}

export function armVideoFirstFrame(el: HTMLVideoElement, fields: Record<string, unknown>): void {
  const withRvfc = el as HTMLVideoElement & {
    requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime?: number; presentedFrames?: number }) => void) => number;
  };
  if (typeof withRvfc.requestVideoFrameCallback !== 'function') return;
  withRvfc.requestVideoFrameCallback((_now, meta) => {
    observeAdEvent('VIDEO_FIRST_FRAME', {
      ...fields,
      currentTime: Number.isFinite(el.currentTime) ? el.currentTime : null,
      mediaTime: meta.mediaTime ?? null,
      presentedFrames: meta.presentedFrames ?? null,
    });
  });
}
