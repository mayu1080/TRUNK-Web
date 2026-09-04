/// <reference types="vite/client" />

import type { ProductionAction, ProductionSnapshot } from './productionApi';

interface AssetIndex {
  version: string;
  listImages: Array<{
    id: string;
    relativePath: string;
    fileName: string;
  }>;
}

declare global {
  interface Window {
    trunkApi: {
      getConfig(): Promise<{
        contentRoot: string;
        isPackaged: boolean;
        monitorId: number;
        monitorCount: number;
        idleTimeoutSeconds: number;
        idleTimeoutSource: 'production' | 'development';
        windowId?: number | null;
        displayId?: number | null;
      }>;
      getProductionSnapshot(): Promise<ProductionSnapshot>;
      getProductionDump(): Promise<unknown>;
      dispatchProduction(action: ProductionAction): Promise<ProductionSnapshot>;
      onProductionStateChanged(callback: (snapshot: ProductionSnapshot) => void): () => void;
      reportBubbleState(state: { bubbleVisible: boolean }): void;
      onBubbleAggregate(
        callback: (payload: {
          activeBubbleCount: number;
          byMonitor: Array<{ monitorId: number; bubbleVisible: boolean }>;
        }) => void,
      ): () => void;
      reportTouchHit(hit: {
        eventType: string;
        pointerId: number | null;
        pointerType: string;
        activePointerCount: number;
        nativeTouchCount: number;
        clientX: number;
        clientY: number;
        screenX: number;
        screenY: number;
      }): void;
      getWindowMapping(): Promise<import('./touchRoutingDebug').WindowMappingDump>;
      onTouchRouting(
        callback: (payload: import('./touchRoutingDebug').TouchRoutingPayload) => void,
      ): () => void;
      logEvent(event: {
        level: 'info' | 'warn' | 'error';
        message: string;
        context?: Record<string, unknown>;
      }): Promise<boolean>;
      getAssetIndex(): Promise<AssetIndex>;
      getExploreImages(): Promise<{
        source: 'listImages' | 'recursive-images';
        images: Array<{
          id: string;
          relativePath: string;
          fileName: string;
          categoryId?: string;
          title?: string;
        }>;
      }>;
      getContentFileUrl(relativePath: string): Promise<string>;
      getContentImageValidation(): Promise<import('./productionApi').ContentImageValidationSummary & {
        issues?: Array<{ level: string; code: string; message: string }>;
      }>;
      getCategories(): Promise<import('./productionApi').ProductionCategory[]>;
      getCategoryGallery(categoryId: string): Promise<import('./productionApi').CategoryGalleryPayload>;
      getSharedCopy(): Promise<import('./productionApi').SharedCopyInfo>;
      getLogoAsset(): Promise<import('./productionApi').LogoAssetInfo>;
      getNoiseAsset(): Promise<import('./productionApi').NoiseAssetInfo>;
      getBrandFonts(): Promise<import('./productionApi').BrandFontCatalog>;
    };
    __productionDebug?: Record<string, unknown>;
  }
}

export {};
