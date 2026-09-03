/**
 * Per-window idle timer (Renderer).
 * Applies only in PRODUCT_LIST / IMAGE_ZOOM / PRODUCT_DETAIL.
 * Resets on user interaction; fires trunkApi.dispatch({ type: 'IDLE_TIMEOUT' }).
 */
(function () {
  const APPLICABLE = ['PRODUCT_LIST', 'IMAGE_ZOOM', 'PRODUCT_DETAIL'];

  /**
   * @param {{
   *   getTimeoutSeconds: () => number,
   *   getScreenState: () => string,
   *   dispatch: (action: { type: string }) => Promise<unknown>,
   *   onCountdown?: (remainingSeconds: number | null) => void,
   * }} options
   */
  function setupIdleTimer(options) {
    const { getTimeoutSeconds, getScreenState, dispatch, onCountdown } = options;

    /** @type {ReturnType<typeof setTimeout> | null} */
    let timeoutId = null;
    /** @type {ReturnType<typeof setInterval> | null} */
    let countdownId = null;
    /** @type {number} */
    let deadlineMs = 0;
    let pointerActive = false;

    function clearTimers() {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (countdownId !== null) {
        clearInterval(countdownId);
        countdownId = null;
      }
      if (onCountdown) onCountdown(null);
    }

    function updateCountdown() {
      if (!onCountdown) return;
      const remaining = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
      onCountdown(remaining);
    }

    function schedule() {
      clearTimers();
      const state = getScreenState();
      if (!APPLICABLE.includes(state)) return;

      const ms = getTimeoutSeconds() * 1000;
      deadlineMs = Date.now() + ms;

      timeoutId = setTimeout(async () => {
        try {
          await dispatch({ type: 'IDLE_TIMEOUT' });
        } catch (_e) {
          /* Main rejects if state changed */
        }
      }, ms);

      if (onCountdown) {
        updateCountdown();
        countdownId = setInterval(updateCountdown, 1000);
      }
    }

    function reset() {
      const state = getScreenState();
      if (!APPLICABLE.includes(state)) return;
      schedule();
    }

    function onStateChanged() {
      clearTimers();
      schedule();
    }

    document.addEventListener(
      'pointerdown',
      () => {
        pointerActive = true;
        reset();
      },
      { passive: true },
    );

    document.addEventListener(
      'pointerup',
      () => {
        pointerActive = false;
      },
      { passive: true },
    );

    document.addEventListener(
      'pointercancel',
      () => {
        pointerActive = false;
      },
      { passive: true },
    );

    document.addEventListener(
      'pointermove',
      () => {
        if (pointerActive) reset();
      },
      { passive: true },
    );

    document.addEventListener('touchstart', reset, { passive: true });

    document.addEventListener('touchmove', reset, { passive: true });

    document.addEventListener('wheel', reset, { passive: true });

    return {
      reset,
      onStateChanged,
      destroy() {
        clearTimers();
      },
    };
  }

  window.TrunkIdleTimer = { setupIdleTimer };
})();
