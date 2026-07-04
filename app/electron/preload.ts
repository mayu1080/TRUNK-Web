import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppConfig,
  AssetIndex,
  Category,
  LogEvent,
  Manifest,
  MonitorState,
  Product,
  StateAction,
  TrunkApi,
} from '../shared/types';

const trunkApi: TrunkApi = {
  getConfig: () => ipcRenderer.invoke('trunk:getConfig'),
  getManifest: () => ipcRenderer.invoke('trunk:getManifest'),
  getCategories: () => ipcRenderer.invoke('trunk:getCategories'),
  getProducts: () => ipcRenderer.invoke('trunk:getProducts'),
  getAssetIndex: () => ipcRenderer.invoke('trunk:getAssetIndex'),
  getContentFileUrl: (relativePath: string) => ipcRenderer.invoke('trunk:getContentFileUrl', relativePath),
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
};

contextBridge.exposeInMainWorld('trunkApi', trunkApi);

export type { AppConfig, AssetIndex, Category, Manifest, MonitorState, Product, StateAction, TrunkApi, LogEvent };
