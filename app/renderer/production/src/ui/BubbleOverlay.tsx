import { useEffect, useRef } from 'react';
import { runtimeConfig } from '../runtimeConfig';
import type { BubbleRuntimeState } from '../types';

interface BubbleOverlayProps {
  getState: () => BubbleRuntimeState | null;
}

export function BubbleOverlay({ getState }: BubbleOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = rootRef.current;
      const state = getState();
      if (!el || !state) return;

      const show = state.visible && state.allowed;
      const half = state.sizePx * 0.5;
      el.style.width = `${state.sizePx}px`;
      el.style.height = `${state.sizePx}px`;
      el.style.left = `${state.screenX - half}px`;
      el.style.top = `${state.screenY - half}px`;
      el.style.opacity = show ? '1' : '0';
      el.style.visibility = show ? 'visible' : 'hidden';
      const motion = runtimeConfig.bubbleMotionId;
      el.classList.toggle('bubble-overlay--visible', show);
      el.classList.toggle('bubble-overlay--elegant', motion === 'elegant');
      el.classList.toggle('bubble-overlay--off', motion === 'off');
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getState]);

  return (
    <div ref={rootRef} className="bubble-overlay bubble-overlay--off" aria-hidden="true">
      <svg className="bubble-overlay__svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="bubble-glint-grad-production" cx="42%" cy="40%" r="58%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.95)" />
            <stop offset="35%" stopColor="rgba(236, 240, 245, 0.72)" />
            <stop offset="70%" stopColor="rgba(210, 218, 228, 0.22)" />
            <stop offset="100%" stopColor="rgba(210, 218, 228, 0)" />
          </radialGradient>
          <filter id="bubble-glint-blur-production" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.55" />
          </filter>
          <filter id="bubble-dust-blur-production" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.35" />
          </filter>
        </defs>
        <circle className="bubble-overlay__base" cx="50" cy="50" r="49.25" fill="none" />
        <g className="bubble-overlay__glint-orbit">
          <ellipse
            className="bubble-overlay__glint"
            cx="99.25"
            cy="50"
            rx="0.85"
            ry="2.65"
            fill="url(#bubble-glint-grad-production)"
            filter="url(#bubble-glint-blur-production)"
          />
          <g className="bubble-overlay__dust" filter="url(#bubble-dust-blur-production)">
            <circle className="bubble-overlay__dust-dot bubble-overlay__dust-dot--a" cx="98.4" cy="46.8" r="0.28" />
            <circle className="bubble-overlay__dust-dot bubble-overlay__dust-dot--b" cx="97.1" cy="48.2" r="0.2" />
            <circle className="bubble-overlay__dust-dot bubble-overlay__dust-dot--c" cx="98.0" cy="52.6" r="0.18" />
          </g>
          <ellipse
            className="bubble-overlay__glint bubble-overlay__glint--opposite"
            cx="0.75"
            cy="50"
            rx="0.85"
            ry="2.65"
            fill="url(#bubble-glint-grad-production)"
            filter="url(#bubble-glint-blur-production)"
          />
          <g className="bubble-overlay__dust" filter="url(#bubble-dust-blur-production)">
            <circle className="bubble-overlay__dust-dot bubble-overlay__dust-dot--d" cx="1.6" cy="53.2" r="0.26" />
            <circle className="bubble-overlay__dust-dot bubble-overlay__dust-dot--e" cx="2.9" cy="51.8" r="0.18" />
          </g>
        </g>
      </svg>
    </div>
  );
}
