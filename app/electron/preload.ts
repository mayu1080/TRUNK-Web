import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppConfig,
  AssetIndex,
  Category,
  ExploreImageSet,
  LogEvent,
  LogoAsset,
  Manifest,
  MonitorState,
  NoiseAsset,
  Product,
  ProductionAction,
  ProductionDump,
  ProductionSnapshot,
  StateAction,
  TrunkApi,
} from '../shared/types';

const trunkApi: TrunkApi = {
  getConfig: () => ipcRenderer.invoke('trunk:getConfig'),
  getManifest: () => ipcRenderer.invoke('trunk:getManifest'),
  getCategories: () => ipcRenderer.invoke('trunk:getCategories'),
  getProducts: () => ipcRenderer.invoke('trunk:getProducts'),
  getAssetIndex: () => ipcRenderer.invoke('trunk:getAssetIndex'),
  getExploreImages: () => ipcRenderer.invoke('trunk:getExploreImages'),
  getContentFileUrl: (relativePath: string) => ipcRenderer.invoke('trunk:getContentFileUrl', relativePath),
  getContentImageValidation: () => ipcRenderer.invoke('trunk:getContentImageValidation'),
  getCategoryGallery: (categoryId: string) => ipcRenderer.invoke('trunk:getCategoryGallery', categoryId),
  getSharedCopy: () => ipcRenderer.invoke('trunk:getSharedCopy'),
  getLogoAsset: () => ipcRenderer.invoke('trunk:getLogoAsset'),
  getNoiseAsset: () => ipcRenderer.invoke('trunk:getNoiseAsset'),
  getBrandFonts: () => ipcRenderer.invoke('trunk:getBrandFonts'),
  logEvent: (event: LogEvent) => ipcRenderer.invoke('trunk:logEvent', event),
  getState: () => ipcRenderer.invoke('trunk:getState'),
  dispatch: (action: StateAction) => ipcRenderer.invoke('trunk:dispatch', action),
  onStateChanged: (callback: (state: MonitorState) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: MonitorState) => callback(state);
    ipcRenderer.on('trunk:state-changed', handler);
    return () => {
      ipcRenderer.removeListener('trunk:state-changed', handler);
    };
  },
  getProductionSnapshot: () => ipcRenderer.invoke('trunk:getProductionSnapshot'),
  getProductionDump: () => ipcRenderer.invoke('trunk:getProductionDump'),
  dispatchProduction: (action: ProductionAction) => ipcRenderer.invoke('trunk:dispatchProduction', action),
  onProductionStateChanged: (callback: (snapshot: ProductionSnapshot) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: ProductionSnapshot) => callback(snapshot);
    ipcRenderer.on('trunk:production-state-changed', handler);
    return () => {
      ipcRenderer.removeListener('trunk:production-state-changed', handler);
    };
  },
  reportBubbleState: (state: { bubbleVisible: boolean }) => {
    ipcRenderer.send('trunk:reportBubbleState', state);
  },
  onBubbleAggregate: (
    callback: (payload: {
      activeBubbleCount: number;
      byMonitor: Array<{ monitorId: number; bubbleVisible: boolean }>;
    }) => void,
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      payload: {
        activeBubbleCount: number;
        byMonitor: Array<{ monitorId: number; bubbleVisible: boolean }>;
      },
    ) => callback(payload);
    ipcRenderer.on('trunk:bubble-aggregate', handler);
    return () => {
      ipcRenderer.removeListener('trunk:bubble-aggregate', handler);
    };
  },
};

contextBridge.exposeInMainWorld('trunkApi', trunkApi);

export type {
  AppConfig,
  AssetIndex,
  Category,
  ExploreImageSet,
  LogoAsset,
  Manifest,
  MonitorState,
  NoiseAsset,
  Product,
  ProductionAction,
  ProductionDump,
  ProductionSnapshot,
  StateAction,
  TrunkApi,
  LogEvent,
};
