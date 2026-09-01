/// <reference types="vite/client" />

import type { AppConfig, MonitorState, StateAction } from './trunkApi';

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
      getConfig(): Promise<AppConfig>;
      getState(): Promise<MonitorState>;
      dispatch(action: StateAction): Promise<MonitorState>;
      onStateChanged(callback: (state: MonitorState) => void): () => void;
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
      getLogoAsset(): Promise<{
        found: boolean;
        fileName: string | null;
        url: string | null;
        logoRoot: string;
      }>;
    };
    __0820Debug?: {
      fps: number;
      hidden: boolean;
      hasFocus: boolean;
      pixelRatio: number;
      pixelRatioCap: number;
      dragging: boolean;
      pinchActive?: boolean;
      wheelMode?: string;
      dollyVelocity?: number;
      lastDollyInput?: string;
      cameraZ?: number;
      targetCameraZ?: number;
      wrapCount?: number;
      shiftHeld?: boolean;
      meshCount: number;
      overlayOpen?: boolean;
      interactionEnabled?: boolean;
      bubbleAllowed?: boolean;
      revealActive?: boolean;
      selectedInstanceId?: string | null;
      selectedSourceImageId?: string | null;
      contextLost?: boolean;
      nearestCardScreen?: { x: number; y: number; instanceId: string } | null;
    };
  }
}

export {};
