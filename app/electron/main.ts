import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import { ContentError } from './content/errors';
import {
  getContentFileUrl,
  getContentService,
  initializeContentService,
} from './content/contentService';
import { resolveContentRoot } from './content/contentRoot';
import { MonitorStateStore } from './state/monitorStateStore';
import { StateCoordinator } from './state/stateCoordinator';
import { resolveIdleTimeoutConfig } from '../shared/idleConfig';
import type { LogEvent, StateAction } from '../shared/types';

const MONITOR_COUNT = Math.max(1, Math.min(4, Number(process.env.TRUNK_MONITOR_COUNT) || 4));
const MONITOR_IDS = Array.from({ length: MONITOR_COUNT }, (_, i) => i + 1);

const monitorWindows = new Map<number, BrowserWindow>();
const webContentsToMonitor = new Map<number, number>();

let stateCoordinator: StateCoordinator | null = null;

function logEvent(event: LogEvent): void {
  const prefix = `[${event.level}]`;
  const msg = event.context ? `${event.message} ${JSON.stringify(event.context)}` : event.message;
  if (event.level === 'error') {
    console.error(prefix, msg);
  } else if (event.level === 'warn') {
    console.warn(prefix, msg);
  } else {
    console.info(prefix, msg);
  }
}

function resolveMonitorId(event: Electron.IpcMainInvokeEvent): number {
  const id = webContentsToMonitor.get(event.sender.id);
  if (id === undefined) {
    throw new Error('Unknown renderer: monitorId not registered');
  }
  return id;
}

function broadcastState(monitorId: number): void {
  if (!stateCoordinator) return;
  const state = stateCoordinator.getState(monitorId);
  StateCoordinator.broadcast(monitorWindows, monitorId, state);
}

function registerIpcHandlers(): void {
  const service = getContentService();

  ipcMain.handle('trunk:getConfig', (event) => {
    const monitorId = resolveMonitorId(event);
    const idle = resolveIdleTimeoutConfig(app.isPackaged);
    return {
      contentRoot: service.contentRoot,
      isPackaged: app.isPackaged,
      monitorId,
      monitorCount: MONITOR_COUNT,
      idleTimeoutSeconds: idle.seconds,
      idleTimeoutSource: idle.source,
    };
  });

  ipcMain.handle('trunk:getManifest', () => service.manifest);
  ipcMain.handle('trunk:getCategories', () => service.categories);
  ipcMain.handle('trunk:getProducts', () => service.products);
  ipcMain.handle('trunk:getAssetIndex', () => service.assetIndex);
  ipcMain.handle('trunk:getContentFileUrl', (_event, relativePath: string) =>
    getContentFileUrl(relativePath),
  );
  ipcMain.handle('trunk:logEvent', (_event, event: LogEvent) => {
    logEvent(event);
    return true;
  });

  ipcMain.handle('trunk:getState', (event) => {
    const monitorId = resolveMonitorId(event);
    return stateCoordinator!.getState(monitorId);
  });

  ipcMain.handle('trunk:dispatch', (event, action: StateAction) => {
    const monitorId = resolveMonitorId(event);
    const previousState = stateCoordinator!.getState(monitorId);
    try {
      const next = stateCoordinator!.dispatch(monitorId, action);
      if (action.type === 'IDLE_TIMEOUT') {
        const idle = resolveIdleTimeoutConfig(app.isPackaged);
        logEvent({
          level: 'info',
          message: 'idle sleep',
          context: {
            monitorId,
            previousScreenState: previousState.screenState,
            returnedToTopAt: new Date().toISOString(),
            timeoutSeconds: idle.seconds,
          },
        });
      } else {
        logEvent({
          level: 'info',
          message: 'state transition',
          context: { monitorId, action: action.type, screenState: next.screenState },
        });
      }
      return next;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logEvent({ level: 'warn', message: 'state transition rejected', context: { monitorId, action: action.type, reason: message } });
      throw err;
    }
  });

  ipcMain.handle('trunk:getAllStates', () => stateCoordinator!.getAllStates());
}

function createMonitorWindow(monitorId: number): void {
  const col = (monitorId - 1) % 2;
  const row = Math.floor((monitorId - 1) / 2);
  const offsetX = 40 + col * 500;
  const offsetY = 40 + row * 360;

  const win = new BrowserWindow({
    x: offsetX,
    y: offsetY,
    width: 480,
    height: 320,
    title: `TRUNK monitor ${monitorId}`,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  monitorWindows.set(monitorId, win);
  webContentsToMonitor.set(win.webContents.id, monitorId);

  win.on('closed', () => {
    monitorWindows.delete(monitorId);
    webContentsToMonitor.delete(win.webContents.id);
  });

  win.loadFile(path.join(app.getAppPath(), 'renderer', 'state-dev.html'));
}

function showContentError(error: unknown): void {
  const message =
    error instanceof ContentError
      ? error.message
      : error instanceof Error
        ? error.message
        : String(error);

  console.error('[content:fatal]', message);
  dialog.showErrorBox('コンテンツ読み込みエラー', message);
}

app.whenReady().then(() => {
  try {
    initializeContentService();

    const store = new MonitorStateStore(MONITOR_IDS);
    stateCoordinator = new StateCoordinator(store, (monitorId) => {
      broadcastState(monitorId);
    });

    registerIpcHandlers();

    for (const id of MONITOR_IDS) {
      createMonitorWindow(id);
    }

    console.info(`[state] initialized ${MONITOR_COUNT} monitor window(s)`);
  } catch (error) {
    showContentError(error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

export { resolveContentRoot, initializeContentService, getContentService };
