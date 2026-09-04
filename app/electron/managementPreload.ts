import { contextBridge, ipcRenderer } from 'electron';
import type { ManagementStatus } from './production/managementStatus';
import type { TouchRoutingPayload } from '../shared/types';

contextBridge.exposeInMainWorld('managementApi', {
  getStatus: () => ipcRenderer.invoke('trunk:getManagementStatus') as Promise<ManagementStatus>,
  onChanged: (callback: (status: ManagementStatus) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: ManagementStatus) => callback(status);
    ipcRenderer.on('trunk:management-status-changed', handler);
    return () => ipcRenderer.removeListener('trunk:management-status-changed', handler);
  },
  onTouchRouting: (callback: (payload: TouchRoutingPayload) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: TouchRoutingPayload) => callback(payload);
    ipcRenderer.on('trunk:touch-routing', handler);
    return () => ipcRenderer.removeListener('trunk:touch-routing', handler);
  },
});
