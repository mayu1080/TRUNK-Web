import type { DemoListCard } from '../types';
import { listConfig } from '../listConfig';

/** Phase 2 仮カード。Phase 3 では画像失敗時 / 0枚時の fallback として残す。 */
export const PHASE_2_PLACEHOLDER_COUNT = 32;

export function createPlaceholderCards(count = listConfig.targetCardCount): DemoListCard[] {
  const cards: DemoListCard[] = [];
  for (let i = 0; i < count; i++) {
    cards.push({
      instanceId: `card_${String(i + 1).padStart(3, '0')}`,
      sourceImageId: `placeholder_${String(i + 1).padStart(3, '0')}`,
      displayIndex: i,
      imageUrl: '',
      duplicated: false,
      title: 'placeholder',
    });
  }
  return cards;
}

export function createPlaceholderCanvas(card: DemoListCard): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 640;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const hue = (card.displayIndex * 47) % 360;
  ctx.fillStyle = `hsl(${hue} 62% 46%)`;
  ctx.fillRect(0, 0, 512, 640);
  ctx.fillStyle = `hsl(${(hue + 48) % 360} 72% 58%)`;
  ctx.fillRect(0, 0, 512, 200);
  ctx.fillStyle = `hsl(${(hue + 200) % 360} 55% 40%)`;
  ctx.fillRect(0, 440, 512, 200);

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = '700 56px Segoe UI, sans-serif';
  ctx.fillText(String(card.displayIndex + 1), 36, 92);
  ctx.font = '22px Segoe UI, sans-serif';
  ctx.fillText(card.instanceId, 36, 140);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '18px Segoe UI, sans-serif';
  const label = !card.imageUrl
    ? 'fallback placeholder'
    : card.duplicated
      ? `loading ${card.sourceImageId} (dup)`
      : `loading ${card.sourceImageId}`;
  ctx.fillText(label, 36, 520);
  if (card.relativePath) {
    ctx.font = '16px Segoe UI, sans-serif';
    ctx.fillText(card.relativePath.slice(-42), 36, 560);
  }
  return canvas;
}
