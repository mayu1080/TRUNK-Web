/** content/ 画像 URL（DB デモと同じパス規則） */
export function toContentUrl(relativePath: string): string {
  return `/content/${relativePath.split('\\').join('/')}`;
}

export interface DemoAssetIndexImage {
  id: string;
  relativePath: string;
  url: string;
  fileName: string;
  categoryId: string;
}

export interface DemoAssetIndex {
  images: DemoAssetIndexImage[];
}
