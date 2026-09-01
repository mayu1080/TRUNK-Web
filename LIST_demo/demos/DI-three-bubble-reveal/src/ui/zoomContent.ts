/** IMAGE_ZOOM 用コピー（デモ — 本番は content メタデータから供給） */

export interface ZoomContent {
  brand: string;
  title: string;
  body: string;
}

const CATEGORY_COPY: Record<string, { title: string; body: string }> = {
  food: {
    title: 'TOKYO FOOD',
    body:
      'フランス料理をベースに、東京らしい日本の美意識や季節感を取り入れた料理スタイル。TRUNK(HOTEL)の料理は、構図・盛り付け・余白の美しさを大切にしながら、素材の表情を丁寧に引き出します。',
  },
  gift: {
    title: 'TOKYO GIFT',
    body:
      '旅の記憶を持ち帰るためのセレクション。日常に溶け込むものから、特別な一日のための一点まで。TRUNK(HOTEL)らしい余白と質感を、贈る手にも届く形で。',
  },
  flower: {
    title: 'NATURE',
    body:
      '季節の移ろいを感じる花や緑。空間に静かなリズムを添える存在として、TRUNK(HOTEL)の世界観とともに編集されています。',
  },
};

const DEFAULT_COPY: ZoomContent = {
  brand: 'TRUNK (HOTEL)',
  title: 'COLLECTION',
  body:
    '東京の美意識と季節感を、写真と余白で編集する TRUNK のコレクション。',
};

export function resolveZoomContent(imageId: string): ZoomContent {
  const parts = imageId.replace(/__dup\d+$/, '').split('/');
  const category = (parts[0] ?? '').toLowerCase();
  const segment = parts[1] ?? parts[parts.length - 1] ?? category;
  const catCopy = CATEGORY_COPY[category];

  if (catCopy) {
    return {
      brand: 'TRUNK (HOTEL)',
      title: catCopy.title,
      body: catCopy.body,
    };
  }

  const label = segment.replace(/[①②③④⑤]/g, '').trim() || category.toUpperCase();
  return {
    ...DEFAULT_COPY,
    title: label.toUpperCase(),
  };
}
