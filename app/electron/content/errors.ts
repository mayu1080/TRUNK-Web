export class ContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentError';
  }
}

export function formatContentError(code: string, detail: string): ContentError {
  const messages: Record<string, string> = {
    CONTENT_ROOT_MISSING: `content フォルダが見つかりません: ${detail}`,
    MANIFEST_MISSING: `manifest.json が見つかりません: ${detail}`,
    MANIFEST_INVALID: `manifest.json が不正です: ${detail}`,
    CATEGORIES_INVALID: `categories.json が不正です: ${detail}`,
    PRODUCTS_INVALID: `products.json が不正です: ${detail}`,
    FILE_MISSING: `参照ファイルが存在しません: ${detail}`,
  };
  return new ContentError(messages[code] ?? `${code}: ${detail}`);
}
