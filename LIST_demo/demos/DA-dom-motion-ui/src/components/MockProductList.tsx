import { useDemoCards } from '../useDemoCards';
import type { MockCard } from '../motionConfig';

const POSITIONS: { x: number; y: number }[] = [
  { x: 8, y: 12 },
  { x: 42, y: 28 },
  { x: 68, y: 8 },
  { x: 22, y: 55 },
  { x: 55, y: 48 },
  { x: 78, y: 62 },
];

interface MockProductListProps {
  cards: MockCard[];
  blocked: boolean;
  onCardTap: (imageId: string, imageUrl: string) => void;
}

export function MockProductList({ cards, blocked, onCardTap }: MockProductListProps) {
  return (
    <div
      className={`list-layer${blocked ? ' blocked' : ''}`}
      aria-hidden={blocked}
    >
      {cards.map((card, i) => {
        const pos = POSITIONS[i % POSITIONS.length]!;
        return (
          <button
            key={`${card.id}-${i}`}
            type="button"
            className="mock-card"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              width: card.w,
              height: card.h,
            }}
            onPointerUp={(e) => {
              if (blocked) return;
              e.stopPropagation();
              onCardTap(card.id, card.imageUrl);
            }}
            disabled={blocked}
          >
            <img
              className="mock-card-img"
              src={card.imageUrl}
              alt=""
              draggable={false}
            />
            <span className="mock-card-label">{card.label}</span>
          </button>
        );
      })}
      <p className="mock-list-hint">仮 LIST — カードタップで IMAGE_ZOOM</p>
    </div>
  );
}
