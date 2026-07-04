import { useEffect, useState } from 'react';
import type { DemoAssetIndex } from './imageUrls';
import { FALLBACK_MOCK_CARDS, type MockCard } from './motionConfig';

const INDEX_URL = '/demo-asset-index.json';

const CARD_LAYOUT: Pick<MockCard, 'w' | 'h' | 'label'>[] = [
  { label: 'Food A', w: 140, h: 100 },
  { label: 'Food B', w: 120, h: 160 },
  { label: 'Gift A', w: 160, h: 110 },
  { label: 'Flower', w: 130, h: 130 },
  { label: 'List Card', w: 150, h: 90 },
  { label: 'CM Prev', w: 110, h: 140 },
];

function cardsFromIndex(index: DemoAssetIndex): MockCard[] {
  const images = index.images ?? [];
  if (images.length === 0) return [...FALLBACK_MOCK_CARDS];

  return CARD_LAYOUT.map((layout, i) => {
    const image = images[i % images.length]!;
    return {
      id: image.id,
      label: layout.label,
      w: layout.w,
      h: layout.h,
      imageUrl: image.url,
    };
  });
}

export function useDemoCards(): { cards: MockCard[]; indexLoaded: boolean } {
  const [cards, setCards] = useState<MockCard[]>(FALLBACK_MOCK_CARDS);
  const [indexLoaded, setIndexLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(INDEX_URL)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: DemoAssetIndex | null) => {
        if (cancelled || !data?.images?.length) return;
        setCards(cardsFromIndex(data));
        setIndexLoaded(true);
      })
      .catch(() => {
        /* fallback cards remain */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { cards, indexLoaded };
}
