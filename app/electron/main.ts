import { app, BrowserWindow, dialog, ipcMain, screen } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { ContentError } from './content/errors';
import {
  getContentFileUrl,
  getContentImageValidation,
  getCategoryGallery,
  getSharedCopy,
  getContentService,
  getExploreImages,
  initializeContentService,
} from './content/contentService';
import { getBrandFonts } from './content/brandFonts';
import {
  registerContentProtocolHandler,
  registerContentSchemePrivileges,
} from './content/contentProtocol';
import { resolveLogoAsset, resolveLogoRoot } from './content/logoAsset';
import { resolveContentRoot } from './content/contentRoot';
import { MonitorStateStore } from './state/monitorStateStore';
import { StateCoordinator } from './state/stateCoordinator';
import { resolveIdleTimeoutConfig, resolveProductionShellIdleTimeout } from '../shared/idleConfig';
import type { LogEvent, StateAction } from '../shared/types';
import type { GlobalScene, ProductionAction } from '../shared/productionState';
import { loadMonitorLayout, MonitorLayoutError } from './production/monitorLayout';
import { resolveWindowPlacement } from './production/windowPlacement';
import { parseProductionPreviewConfig } from './production/previewConfig';
import { resolveNoiseAsset } from './production/noiseAsset';
import { ProductionStateCoordinator } from './production/productionStateCoordinator';
import { loadVideoPlaylist } from './production/videoPlaylist';
import { VideoSyncController } from './production/videoSyncController';
import { TouchActivityManager } from './production/touchActivityManager';

registerContentSchemePrivileges();

const TRUNK_DEMO = process.env.TRUNK_DEMO ?? '';
const DEMO_0820 = TRUNK_DEMO === '0820';
const DEMO_0820_COLOR = TRUNK_DEMO === '0820-color';
const DEMO_0820_FAMILY = DEMO_0820 || DEMO_0820_COLOR;
const PRODUCTION_SHELL = TRUNK_DEMO === 'production';
const MONITOR_COUNT = DEMO_0820_FAMILY
  ? 1
  : PRODUCTION_SHELL
    ? 4
    : Math.max(1, Math.min(4, Number(process.env.TRUNK_MONITOR_COUNT) || 4));
const MONITOR_IDS = Array.from({ length: MONITOR_COUNT }, (_, i) => i + 1);

const monitorWindows = new Map<number, BrowserWindow>();
const webContentsToMonitor = new Map<number, number>();

let stateCoordinator: StateCoordinator | null = null;
let productionCoordinator: ProductionStateCoordinator | null = null;
let productionVideo: VideoSyncController | null = null;
let productionIdle: TouchActivityManager | null = null;
let lastProductionScene: GlobalScene = 'AD_IDLE';

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

function broadcastProduction(reason: string): void {
  if (!productionCoordinator) return;
  const scene = productionCoordinator.getGlobalScene();
  if (scene !== lastProductionScene) {
    logEvent({
      level: 'info',
      message: 'globalScene transition',
      context: { from: lastProductionScene, to: scene, reason },
    });
    productionVideo?.onScene(scene);
    productionIdle?.onScene(scene);
    lastProductionScene = scene;
  } else if (scene === 'PRODUCT_LIST') {
    productionIdle?.noteValidTouch();
  }

  const quiet = reason.startsWith('touch activity');
  if (!quiet) {
    logEvent({ level: 'info', message: 'production state update', context: { reason } });
    logEvent({
      level: 'info',
      message: 'production dump',
      context: productionCoordinator.dump() as unknown as Record<string, unknown>,
    });
  }
  ProductionStateCoordinator.broadcastAll(monitorWindows, productionCoordinator);
}

function registerSharedIpc(): void {
  const service = getContentService();

  ipcMain.handle('trunk:getConfig', (event) => {
    const monitorId = resolveMonitorId(event);
    const idle = PRODUCTION_SHELL
      ? resolveProductionShellIdleTimeout(app.isPackaged)
      : resolveIdleTimeoutConfig(app.isPackaged);
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
  ipcMain.handle('trunk:getExploreImages', () => getExploreImages());
  ipcMain.handle('trunk:getContentFileUrl', (_event, relativePath: string) =>
    getContentFileUrl(relativePath),
  );
  ipcMain.handle('trunk:getContentImageValidation', () => getContentImageValidation());
  ipcMain.handle('trunk:getCategoryGallery', (_event, categoryId: string) => getCategoryGallery(categoryId));
  ipcMain.handle('trunk:getSharedCopy', () => getSharedCopy());
  ipcMain.handle('trunk:getLogoAsset', () =>
    resolveLogoAsset(PRODUCTION_SHELL ? { contentRoot: getContentService().contentRoot } : undefined),
  );
  ipcMain.handle('trunk:getNoiseAsset', () => resolveNoiseAsset(getContentService().contentRoot));
  ipcMain.handle('trunk:getBrandFonts', () => getBrandFonts());
  ipcMain.handle('trunk:logEvent', (_event, event: LogEvent) => {
    logEvent(event);
    return true;
  });
}

function registerLegacyStateIpc(): void {
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
      logEvent({
        level: 'warn',
        message: 'state transition rejected',
        context: { monitorId, action: action.type, reason: message },
      });
      throw err;
    }
  });

  ipcMain.handle('trunk:getAllStates', () => stateCoordinator!.getAllStates());
}

function registerProductionIpc(): void {
  ipcMain.handle('trunk:getProductionSnapshot', (event) => {
    const monitorId = resolveMonitorId(event);
    return productionCoordinator!.snapshotFor(monitorId);
  });

  ipcMain.handle('trunk:getProductionDump', () => productionCoordinator!.dump());

  ipcMain.handle('trunk:dispatchProduction', (event, action: ProductionAction) => {
    const monitorId = resolveMonitorId(event);
    try {
      const snapshot = productionCoordinator!.dispatch(monitorId, action);
      return snapshot;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logEvent({
        level: 'warn',
        message: 'production state transition rejected',
        context: { monitorId, action: action.type, reason: message },
      });
      throw err;
    }
  });
}

function resolveDemo0820Index(): string {
  const rendererDir = DEMO_0820_COLOR ? 'demo-0820-color' : 'demo-0820';
  const startHint = DEMO_0820_COLOR ? 'npm run start:0820-color' : 'npm run start:0820';
  const indexPath = path.join(app.getAppPath(), 'renderer', rendererDir, 'dist', 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error(`8/20 demo renderer is not built. From app/: ${startHint}`);
  }
  return indexPath;
}

function resolveDemo0820WindowBounds(): { x: number; y: number; width: number; height: number } {
  const display = screen.getPrimaryDisplay();
  const area = display.workArea;
  const portraitField = area.height >= area.width && area.height >= 1600;
  if (portraitField) {
    return { x: area.x, y: area.y, width: area.width, height: area.height };
  }
  return { x: area.x + 80, y: area.y + 40, width: 540, height: 960 };
}

function resolveProductionIndex(): string {
  const indexPath = path.join(app.getAppPath(), 'renderer', 'production', 'dist', 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error('production renderer is not built. From app/: npm run start:production');
  }
  return indexPath;
}

function attachWindow(
  monitorId: number,
  bounds: { x: number; y: number; width: number; height: number },
  title: string,
  options?: { resizable?: boolean; frame?: boolean },
): BrowserWindow {
  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    title,
    frame: options?.frame ?? true,
    autoHideMenuBar: true,
    backgroundColor: '#0b0b0c',
    resizable: options?.resizable ?? true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  monitorWindows.set(monitorId, win);
  webContentsToMonitor.set(win.webContents.id, monitorId);
  logEvent({
    level: 'info',
    message: 'created window',
    context: {
      monitorId,
      webContentsId: win.webContents.id,
      bounds,
      title,
    },
  });

  win.on('closed', () => {
    monitorWindows.delete(monitorId);
    webContentsToMonitor.delete(win.webContents.id);
  });

  return win;
}

function createLegacyMonitorWindow(monitorId: number): void {
  const col = (monitorId - 1) % 2;
  const row = Math.floor((monitorId - 1) / 2);
  const demoBounds = DEMO_0820_FAMILY ? resolveDemo0820WindowBounds() : null;
  const offsetX = demoBounds ? demoBounds.x : 40 + col * 500;
  const offsetY = demoBounds ? demoBounds.y : 40 + row * 360;
  const bounds = demoBounds ?? { x: offsetX, y: offsetY, width: 480, height: 320 };
  const title = DEMO_0820_COLOR
    ? `TRUNK 0820-color demo (monitor ${monitorId})`
    : DEMO_0820
      ? `TRUNK 0820 demo (monitor ${monitorId})`
      : `TRUNK monitor ${monitorId}`;

  const win = attachWindow(monitorId, bounds, title);

  if (DEMO_0820_FAMILY) {
    try {
      win.webContents.setVisualZoomLevelLimits(1, 1);
    } catch (err) {
      logEvent({
        level: 'warn',
        message: 'failed to lock visual zoom (pinch may zoom the page)',
        context: { reason: err instanceof Error ? err.message : String(err) },
      });
    }
    win.loadFile(resolveDemo0820Index());
    return;
  }

  win.loadFile(path.join(app.getAppPath(), 'renderer', 'state-dev.html'));
}

function showContentError(error: unknown): void {
  const message =
    error instanceof ContentError || error instanceof MonitorLayoutError
      ? error.message
      : error instanceof Error
        ? error.message
        : String(error);

  console.error('[content:fatal]', message);
  dialog.showErrorBox('コンテンツ読み込みエラー', message);
}

function startProductionShell(): void {
  const service = getContentService();
  logEvent({
    level: 'info',
    message: 'app start',
    context: { shell: 'production', contentRoot: service.contentRoot, isPackaged: app.isPackaged },
  });

  const { layout, layoutPath } = loadMonitorLayout(service.contentRoot);
  logEvent({
    level: 'info',
    message: 'loaded monitor layout',
    context: {
      layoutPath,
      boundsTolerancePx: layout.boundsTolerancePx,
      fatalOnBoundsMismatch: layout.fatalOnBoundsMismatch,
      monitorIds: layout.monitors.map((m) => m.monitorId),
    },
  });

  const placement = resolveWindowPlacement(layout, screen.getAllDisplays(), {
    isPackaged: app.isPackaged,
    preview: parseProductionPreviewConfig(process.env, { isPackaged: app.isPackaged }),
  });

  for (const warning of placement.warnings) {
    logEvent({
      level: placement.boundsMismatch ? 'warn' : 'info',
      message: warning.startsWith('bounds mismatch') || warning.startsWith('dev fallback')
        ? warning.startsWith('dev fallback')
          ? 'dev fallback mode'
          : 'bounds mismatch warning'
        : warning,
      context: { warning, isDevFallback: placement.isDevFallback },
    });
  }

  logEvent({
    level: placement.shouldQuit ? 'error' : 'info',
    message: 'fatalOnBoundsMismatch result',
    context: {
      fatalOnBoundsMismatch: placement.fatalOnBoundsMismatch,
      boundsMismatch: placement.boundsMismatch,
      shouldQuit: placement.shouldQuit,
      quitReason: placement.quitReason,
      isDevFallback: placement.isDevFallback,
      isPreviewMode: placement.isPreviewMode,
      previewMode: placement.previewMode,
      previewWindows: placement.previewWindows,
      previewFrame: placement.previewFrame,
      previewScale: placement.previewScale,
      managementDisplayIds: placement.managementDisplayIds,
    },
  });

  if (placement.shouldQuit) {
    throw new MonitorLayoutError(placement.quitReason ?? 'monitor layout fatal');
  }

  const ads = loadVideoPlaylist(service.contentRoot, 'ads');
  const animation = loadVideoPlaylist(service.contentRoot, 'animation');
  for (const warning of [...ads.warnings, ...animation.warnings]) {
    logEvent({ level: 'warn', message: 'video playlist warning', context: { warning } });
    placement.warnings.push(warning);
  }
  logEvent({
    level: 'info',
    message: 'loaded video playlists',
    context: {
      adsContentId: ads.contentId,
      adsDurationMs: ads.durationMs,
      adsFound: ads.tracks.filter((t) => t.found).length,
      animationContentId: animation.contentId,
      animationDurationMs: animation.durationMs,
      animationFound: animation.tracks.filter((t) => t.found).length,
      skipOnTouch: false,
    },
  });

  const noise = resolveNoiseAsset(service.contentRoot);
  if (noise.warning) {
    logEvent({ level: 'warn', message: 'noise asset warning', context: { warning: noise.warning } });
    placement.warnings.push(noise.warning);
  } else {
    logEvent({
      level: 'info',
      message: 'noise asset',
      context: { fileName: noise.fileName, relativePath: noise.relativePath },
    });
  }

  const productionMonitorIds = placement.windows.map((row) => row.monitorId);
  const firstMonitorId = productionMonitorIds[0] ?? MONITOR_IDS[0]!;
  const placements = new Map(placement.windows.map((row) => [row.monitorId, row]));
  productionCoordinator = new ProductionStateCoordinator(
    productionMonitorIds,
    {
      isDevFallback: placement.isDevFallback,
      isPreviewMode: placement.isPreviewMode,
      previewMode: placement.previewMode,
      previewWindows: placement.previewWindows,
      previewScale: placement.previewScale,
      previewLogicalWidth: placement.previewLogicalWidth,
      previewLogicalHeight: placement.previewLogicalHeight,
      boundsMismatch: placement.boundsMismatch,
      fatalOnBoundsMismatch: placement.fatalOnBoundsMismatch,
      contentRoot: service.contentRoot,
      layoutPath,
      warnings: placement.warnings,
      placements,
    },
    (reason) => broadcastProduction(reason),
  );

  const idleTimeout = resolveProductionShellIdleTimeout(app.isPackaged);
  productionIdle = new TouchActivityManager(
    () => idleTimeout.seconds,
    idleTimeout.source,
    () => {
      logEvent({
        level: 'info',
        message: 'global idle timeout',
        context: { timeoutSeconds: idleTimeout.seconds, source: idleTimeout.source },
      });
      productionCoordinator?.dispatch(firstMonitorId, { type: 'GLOBAL_IDLE_TIMEOUT' });
    },
  );
  productionVideo = new VideoSyncController(
    ads,
    animation,
    () => {
      productionCoordinator?.dispatch(firstMonitorId, { type: 'ANIMATION_COMPLETE' });
    },
    (message, context) => logEvent({ level: 'info', message, context }),
  );
  productionCoordinator.attachPhase2({
    videoFor: (monitorId) => productionVideo!.sessionFor(monitorId),
    videoDump: () => productionVideo!.dumpSummary(),
    idleDump: () => productionIdle!.dump(),
  });
  lastProductionScene = 'AD_IDLE';
  productionVideo.onScene('AD_IDLE');
  productionIdle.onScene('AD_IDLE');
  // Production and preview:multi start AD_IDLE (touch → ANIMATION → PRODUCT_LIST).
  // Single-window preview skips to PRODUCT_LIST for LIST / overlay QA. Keys 1 / 2 / 3 retarget the scene.
  if (placement.isPreviewMode && placement.previewWindows === 'single') {
    productionCoordinator.dispatch(firstMonitorId, { type: 'SET_GLOBAL_SCENE', scene: 'PRODUCT_LIST' });
  }

  registerSharedIpc();
  registerProductionIpc();

  const indexPath = resolveProductionIndex();
  for (const row of placement.windows) {
    logEvent({
      level: 'info',
      message: 'monitorId assignment',
      context: {
        monitorId: row.monitorId,
        matchedDisplayId: row.matchedDisplayId,
        windowBounds: row.bounds,
        configBounds: {
          x: row.config.x,
          y: row.config.y,
          width: row.config.width,
          height: row.config.height,
        },
        viewportOffsetX: row.config.viewportOffsetX,
        viewportOffsetY: row.config.viewportOffsetY,
      },
    });
    const previewTitle =
      placement.previewWindows === 'single'
        ? 'preview single'
        : placement.previewWindows === 'multi'
          ? 'preview multi'
          : 'production';
    const win = attachWindow(
      row.monitorId,
      row.bounds,
      `TRUNK ${placement.isPreviewMode ? previewTitle : 'production'} (monitor ${row.monitorId})`,
      placement.isPreviewMode
        ? {
            frame: placement.previewFrame,
            resizable: placement.previewWindows === 'single',
          }
        : { frame: false, resizable: false },
    );
    win.loadFile(indexPath);
  }

  logEvent({
    level: 'info',
    message: 'production dump',
    context: productionCoordinator.dump() as unknown as Record<string, unknown>,
  });
}

function startLegacyShell(): void {
  const store = new MonitorStateStore(MONITOR_IDS);
  stateCoordinator = new StateCoordinator(store, (monitorId) => {
    broadcastState(monitorId);
  });

  registerSharedIpc();
  registerLegacyStateIpc();

  for (const id of MONITOR_IDS) {
    createLegacyMonitorWindow(id);
  }

  console.info(
    `[state] initialized ${MONITOR_COUNT} monitor window(s)${
      DEMO_0820_COLOR
        ? ' (TRUNK_DEMO=0820-color single-monitor)'
        : DEMO_0820
          ? ' (TRUNK_DEMO=0820 single-monitor)'
          : ''
    }`,
  );
}

app.whenReady().then(() => {
  try {
    initializeContentService();
    registerContentProtocolHandler(
      () => getContentService().contentRoot,
      () => resolveLogoRoot(),
    );

    if (PRODUCTION_SHELL) {
      startProductionShell();
    } else {
      startLegacyShell();
    }
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
