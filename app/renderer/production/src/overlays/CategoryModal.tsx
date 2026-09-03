import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import { BoxLogo } from '../ui/BoxLogo';
import { CATEGORY_MODAL_MOTION, SQUARE_LOGO_RELATIVE_PATH } from '../categoryModalMotion';

export interface CategoryModalSlide {
  id: string;
  url: string;
  title: string;
  description: string;
  kind?: 'cover' | 'content';
  courseName?: string | null;
}

interface CategoryModalProps {
  open: boolean;
  categoryLabel: string;
  categoryTitle?: string;
  categoryDescription?: string;
  slides: CategoryModalSlide[];
  onClose: () => void;
  onIndexChange?: (index: number) => void;
}

interface HeldModal {
  categoryLabel: string;
  categoryTitle: string;
  categoryDescription: string;
  slides: CategoryModalSlide[];
}

const SLIDE_PCT = 76;
const SWIPE_PX = 48;
const FLICK_PX_PER_MS = 0.42;
const TRANSITION_MS = 320;
const FALLBACK_DESCRIPTION = '説明文がここに入ります。';

export function CategoryModal({
  open,
  categoryLabel,
  categoryTitle,
  categoryDescription,
  slides,
  onClose,
  onIndexChange,
}: CategoryModalProps) {
  const [mounted, setMounted] = useState(open);
  const [openClass, setOpenClass] = useState(open);
  const [held, setHeld] = useState<HeldModal>(() =>
    snapshotCopy(categoryLabel, categoryTitle, categoryDescription, slides),
  );
  const [squareLogo, setSquareLogo] = useState<{ url: string | null; found: boolean }>({
    url: null,
    found: false,
  });

  const shown = open ? snapshotCopy(categoryLabel, categoryTitle, categoryDescription, slides) : held;
  const count = shown.slides.length;
  const single = count <= 1;
  const loopable = count >= 2;
  const [visualIndex, setVisualIndex] = useState(loopable ? 1 : 0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [instant, setInstant] = useState(false);
  const dragRef = useRef<{ pointerId: number; startX: number; lastX: number; lastT: number; vx: number } | null>(
    null,
  );
  const wrapTimer = useRef<number>(0);
  const peek = (100 - SLIDE_PCT) / 2;

  const logicalIndex = useMemo(() => {
    if (count === 0) return 0;
    if (!loopable) return Math.min(visualIndex, count - 1);
    if (visualIndex <= 0) return count - 1;
    if (visualIndex >= count + 1) return 0;
    return visualIndex - 1;
  }, [count, loopable, visualIndex]);

  const renderSlides = useMemo(() => {
    if (!loopable) return shown.slides.map((item, source) => ({ item, key: item.id, source }));
    const last = shown.slides[count - 1]!;
    const first = shown.slides[0]!;
    return [
      { item: last, key: `${last.id}-clone-head`, source: count - 1 },
      ...shown.slides.map((item, source) => ({ item, key: item.id, source })),
      { item: first, key: `${first.id}-clone-tail`, source: 0 },
    ];
  }, [count, loopable, shown.slides]);

  useEffect(() => {
    if (!window.trunkApi?.getContentFileUrl) return;
    let cancelled = false;
    void window.trunkApi
      .getContentFileUrl(SQUARE_LOGO_RELATIVE_PATH)
      .then((url) => {
        if (!cancelled) setSquareLogo({ url, found: true });
      })
      .catch(() => {
        if (!cancelled) setSquareLogo({ url: null, found: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (open) {
      setHeld(snapshotCopy(categoryLabel, categoryTitle, categoryDescription, slides));
      setMounted(true);
      setOpenClass(false);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setOpenClass(true));
      });
      return () => window.cancelAnimationFrame(frame);
    }
    setOpenClass(false);
    const timer = window.setTimeout(() => setMounted(false), CATEGORY_MODAL_MOTION.closeMs);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setHeld(snapshotCopy(categoryLabel, categoryTitle, categoryDescription, slides));
  }, [open, categoryLabel, categoryTitle, categoryDescription, slides]);

  useEffect(() => {
    if (!open) return;
    window.clearTimeout(wrapTimer.current);
    setVisualIndex(loopable ? 1 : 0);
    setDragX(0);
    setInstant(false);
  }, [open, shown.categoryLabel, count, loopable]);

  useEffect(() => {
    onIndexChange?.(logicalIndex);
  }, [logicalIndex, onIndexChange]);

  useEffect(() => {
    return () => window.clearTimeout(wrapTimer.current);
  }, []);

  const goLogical = useCallback(
    (nextLogical: number) => {
      if (count === 0) return;
      if (!loopable) {
        setVisualIndex(Math.max(0, Math.min(count - 1, nextLogical)));
        return;
      }
      const wrapped = ((nextLogical % count) + count) % count;
      setVisualIndex(wrapped + 1);
    },
    [count, loopable],
  );

  const step = useCallback(
    (direction: 1 | -1) => {
      if (!loopable) {
        goLogical(logicalIndex + direction);
        return;
      }
      setVisualIndex((current) => current + direction);
    },
    [goLogical, logicalIndex, loopable],
  );

  useEffect(() => {
    if (!loopable) return;
    if (visualIndex !== 0 && visualIndex !== count + 1) return;
    window.clearTimeout(wrapTimer.current);
    wrapTimer.current = window.setTimeout(() => {
      setInstant(true);
      setVisualIndex(visualIndex === 0 ? count : 1);
    }, TRANSITION_MS);
    return () => window.clearTimeout(wrapTimer.current);
  }, [count, loopable, visualIndex]);

  useEffect(() => {
    if (!instant) return;
    const id = window.requestAnimationFrame(() => setInstant(false));
    return () => window.cancelAnimationFrame(id);
  }, [instant]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (single) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      lastX: event.clientX,
      lastT: event.timeStamp,
      vx: 0,
    };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dt = Math.max(1, event.timeStamp - drag.lastT);
    drag.vx = (event.clientX - drag.lastX) / dt;
    drag.lastX = event.clientX;
    drag.lastT = event.timeStamp;
    setDragX(event.clientX - drag.startX);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    setDragX(0);
    if (!drag || drag.pointerId !== event.pointerId || single) return;
    const delta = event.clientX - drag.startX;
    const flicked = Math.abs(drag.vx) >= FLICK_PX_PER_MS;
    if (delta <= -SWIPE_PX || (flicked && drag.vx < 0)) step(1);
    else if (delta >= SWIPE_PX || (flicked && drag.vx > 0)) step(-1);
  };

  const stopScrollLeak = (event: PointerEvent<HTMLDivElement> | WheelEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  const trackStyle = useMemo(() => {
    if (single) {
      return {
        transform: 'none',
        justifyContent: 'center',
        transition: 'none',
      };
    }
    return {
      transform: `translateX(calc(${peek}% - ${visualIndex * SLIDE_PCT}% + ${dragX}px))`,
      transition: dragging || instant ? 'none' : `transform ${TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
    };
  }, [dragX, dragging, instant, peek, single, visualIndex]);

  if (!mounted) return null;

  const closing = mounted && !openClass && !open;
  const currentSlide = count > 0 ? shown.slides[logicalIndex] : undefined;
  const courseName = currentSlide?.courseName?.trim() || '';
  const title = shown.categoryTitle || shown.categoryLabel;
  const description = shown.categoryDescription.trim() || FALLBACK_DESCRIPTION;

  return (
    <div
      className={`category-modal${openClass ? ' is-open' : ''}${closing ? ' is-closing' : ''}${single ? ' is-single' : ''}${loopable ? ' is-loop' : ''}`}
      role="dialog"
      aria-modal={open}
      aria-label={shown.categoryLabel}
      onClick={onClose}
    >
      <div className="category-modal__card" onClick={(event) => event.stopPropagation()}>
        <div className="category-modal__logo">
          <BoxLogo url={squareLogo.url} found={squareLogo.found} />
        </div>
        <button type="button" className="category-modal__close" onClick={onClose} aria-label="close">
          <span className="category-modal__close-glyph" aria-hidden="true">
            ×
          </span>
        </button>
        <div
          className="category-modal__viewport"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            dragRef.current = null;
            setDragging(false);
            setDragX(0);
          }}
        >
          {count === 0 ? (
            <p className="category-modal__empty">no images in this category</p>
          ) : (
            <div className="category-modal__track" style={trackStyle}>
              {renderSlides.map((entry) => (
                <figure
                  key={entry.key}
                  className={`category-modal__slide${entry.source === logicalIndex ? ' is-active' : ''}`}
                  style={{ flexBasis: `${SLIDE_PCT}%` }}
                >
                  <img className="category-modal__image" src={entry.item.url} alt={entry.item.title} draggable={false} />
                </figure>
              ))}
            </div>
          )}
        </div>
        <div className="category-modal__copy">
          {courseName ? <p className="category-modal__course">{courseName}</p> : null}
          <h2 className="category-modal__title">{title}</h2>
          <div
            className="category-modal__description"
            onPointerDown={stopScrollLeak}
            onPointerMove={stopScrollLeak}
            onWheel={stopScrollLeak}
          >
            {description}
          </div>
        </div>
      </div>
    </div>
  );
}

function snapshotCopy(
  categoryLabel: string,
  categoryTitle: string | undefined,
  categoryDescription: string | undefined,
  slides: CategoryModalSlide[],
): HeldModal {
  return {
    categoryLabel,
    categoryTitle: categoryTitle?.trim() || categoryLabel,
    categoryDescription: categoryDescription ?? '',
    slides,
  };
}
