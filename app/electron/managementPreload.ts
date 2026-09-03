import { contextBridge, ipcRenderer } from 'electron';
import type { ManagementStatus } from './production/managementStatus';

contextBridge.exposeInMainWorld('managementApi', {
  getStatus: () => ipcRenderer.invoke('trunk:getManagementStatus') as Promise<ManagementStatus>,
  onChanged: (callback: (status: ManagementStatus) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: ManagementStatus) => callback(status);
    ipcRenderer.on('trunk:management-status-changed', handler);
    return () => ipcRenderer.removeListener('trunk:management-status-changed', handler);
  },
});
