import type { BrowserWindow } from 'electron';
import {
  AD_MODE,
  createInitialPerMonitorState,
  withOverlayLock,
  type GlobalScene,
  type IdleDebugInfo,
  type LocalOverlay,
  type PerMonitorState,
  type ProductionAction,
  type ProductionDump,
  type ProductionSnapshot,
  type MonitorLayoutInfo,
  type VideoSessionInfo,
} from '../../shared/productionState';
import type { MonitorPlacement } from './windowPlacement';

export interface ProductionRuntimeMeta {
  isDevFallback: boolean;
  isPreviewMode?: boolean;
  previewMode?: 'off' | 'portrait' | 'fullhd';
  previewWindows?: 'off' | 'single' | 'multi';
  previewScale?: number | null;
  previewLogicalWidth?: number | null;
  previewLogicalHeight?: number | null;
  boundsMismatch: boolean;
  fatalOnBoundsMismatch: boolean;
  contentRoot: string;
  layoutPath: string;
  warnings: string[];
  placements: Map<number, MonitorPlacement>;
}

export interface Phase2Providers {
  videoFor(monitorId: number): VideoSessionInfo;
  videoDump(): Omit<VideoSessionInfo, 'track'> & { tracksFound: number };
  idleDump(): IdleDebugInfo;
}

const NONE_VIDEO: VideoSessionInfo = {
  scene: 'none',
  contentId: 'none',
  sessionId: 0,
  startedAtMs: 0,
  durationMs: 0,
  loop: false,
  skipOnTouch: false,
  track: { monitorId: 0, relativePath: '', url: null, found: false },
};

const NONE_IDLE: IdleDebugInfo = {
  timeoutSeconds: 120,
  source: 'development',
  armed: false,
  lastValidTouchAtMs: null,
};

function layoutInfoFor(placement: MonitorPlacement): MonitorLayoutInfo {
  return {
    x: placement.config.x,
    y: placement.config.y,
    width: placement.config.width,
    height: placement.config.height,
    orientation: placement.config.orientation,
    viewportOffsetX: placement.config.viewportOffsetX,
    viewportOffsetY: placement.config.viewportOffsetY,
    scale: placement.config.scale,
    windowBounds: { ...placement.bounds },
    configBounds: {
      x: placement.config.x,
      y: placement.config.y,
      width: placement.config.width,
      height: placement.config.height,
    },
    matchedDisplayId: placement.matchedDisplayId,
  };
}

export class ProductionStateCoordinator {
  private globalScene: GlobalScene = 'AD_IDLE';
  private readonly states = new Map<number, PerMonitorState>();
  private phase2: Phase2Providers | null = null;

  constructor(
    monitorIds: number[],
    private meta: ProductionRuntimeMeta,
    private readonly onChange: (reason: string) => void,
  ) {
    for (const id of monitorIds) {
      this.states.set(id, createInitialPerMonitorState(id));
    }
  }

  attachPhase2(providers: Phase2Providers): void {
    this.phase2 = providers;
  }

  getGlobalScene(): GlobalScene {
    return this.globalScene;
  }

  getMonitor(monitorId: number): PerMonitorState {
    const state = this.states.get(monitorId);
    if (!state) throw new Error(`Unknown monitorId: ${monitorId}`);
    return state;
  }

  getAllMonitors(): PerMonitorState[] {
    return [...this.states.values()].sort((a, b) => a.monitorId - b.monitorId);
  }

  dump(): ProductionDump {
    const video = this.phase2?.videoDump() ?? {
      scene: 'none' as const,
      contentId: 'none',
      sessionId: 0,
      startedAtMs: 0,
      durationMs: 0,
      loop: false,
      skipOnTouch: false,
      tracksFound: 0,
    };
    return {
      globalScene: this.globalScene,
      adMode: AD_MODE,
      isDevFallback: this.meta.isDevFallback,
      isPreviewMode: this.meta.isPreviewMode ?? false,
      previewMode: this.meta.previewMode ?? 'off',
      previewWindows: this.meta.previewWindows ?? 'off',
      previewScale: this.meta.previewScale ?? null,
      boundsMismatch: this.meta.boundsMismatch,
      fatalOnBoundsMismatch: this.meta.fatalOnBoundsMismatch,
      layoutPath: this.meta.layoutPath,
      warnings: [...this.meta.warnings],
      video,
      idle: this.phase2?.idleDump() ?? NONE_IDLE,
      monitors: this.getAllMonitors().map((m) => ({
        monitorId: m.monitorId,
        localOverlay: m.localOverlay,
        interactionLocked: m.interactionLocked,
        selectedImageId: m.selectedImageId,
        selectedCategoryId: m.selectedCategoryId,
      })),
    };
  }

  snapshotFor(monitorId: number): ProductionSnapshot {
    const own = this.getMonitor(monitorId);
    const placement = this.meta.placements.get(monitorId);
    if (!placement) throw new Error(`No placement for monitorId: ${monitorId}`);
    return {
      globalScene: this.globalScene,
      adMode: AD_MODE,
      monitorId,
      own,
      monitors: this.dump().monitors,
      layout: layoutInfoFor(placement),
      video: this.phase2?.videoFor(monitorId) ?? { ...NONE_VIDEO, track: { ...NONE_VIDEO.track, monitorId } },
      idle: this.phase2?.idleDump() ?? NONE_IDLE,
      debug: {
        isDevFallback: this.meta.isDevFallback,
        isPreviewMode: this.meta.isPreviewMode ?? false,
        previewMode: this.meta.previewMode ?? 'off',
        previewWindows: this.meta.previewWindows ?? 'off',
        previewScale: this.meta.previewScale ?? null,
        previewLogicalWidth: this.meta.previewLogicalWidth ?? null,
        previewLogicalHeight: this.meta.previewLogicalHeight ?? null,
        boundsMismatch: this.meta.boundsMismatch,
        fatalOnBoundsMismatch: this.meta.fatalOnBoundsMismatch,
        contentRoot: this.meta.contentRoot,
        layoutPath: this.meta.layoutPath,
        warnings: [...this.meta.warnings],
      },
    };
  }

  dispatch(monitorId: number, action: ProductionAction): ProductionSnapshot {
    switch (action.type) {
      case 'SET_GLOBAL_SCENE':
        this.setGlobalScene(action.scene);
        break;
      case 'AD_IDLE_TOUCH':
        if (this.globalScene === 'ANIMATION') {
          return this.snapshotFor(monitorId);
        }
        if (this.globalScene !== 'AD_IDLE') {
          throw new Error(`AD_IDLE_TOUCH requires globalScene=AD_IDLE (got ${this.globalScene})`);
        }
        this.setGlobalScene('ANIMATION');
        break;
      case 'ANIMATION_COMPLETE':
        if (this.globalScene !== 'ANIMATION') {
          return this.snapshotFor(monitorId);
        }
        this.setGlobalScene('PRODUCT_LIST');
        break;
      case 'GLOBAL_IDLE_TIMEOUT':
        if (this.globalScene !== 'PRODUCT_LIST') {
          return this.snapshotFor(monitorId);
        }
        this.setGlobalScene('AD_IDLE');
        break;
      case 'REPORT_TOUCH_ACTIVITY':
        // Global 120s idle only. Must not carry pointer/camera/bubble into other windows.
        if (this.globalScene !== 'PRODUCT_LIST') {
          return this.snapshotFor(monitorId);
        }
        this.onChange(`touch activity monitor=${monitorId}`);
        break;
      case 'OPEN_IMAGE_ZOOM':
        this.setOverlay(monitorId, 'IMAGE_ZOOM', { selectedImageId: action.imageId ?? null });
        break;
      case 'OPEN_CATEGORY_DRAWER':
        this.setOverlay(monitorId, 'CATEGORY_DRAWER', { selectedImageId: null });
        break;
      case 'OPEN_CATEGORY_MODAL':
        this.setOverlay(monitorId, 'CATEGORY_MODAL', {
          selectedImageId: null,
          selectedCategoryId: action.categoryId ?? this.getMonitor(monitorId).selectedCategoryId,
        });
        break;
      case 'CLOSE_OVERLAY':
        this.setOverlay(monitorId, 'NONE', { selectedImageId: null, selectedCategoryId: null });
        break;
      default: {
        const _never: never = action;
        throw new Error(`unknown production action: ${JSON.stringify(_never)}`);
      }
    }
    return this.snapshotFor(monitorId);
  }

  private setGlobalScene(scene: GlobalScene): void {
    const previous = this.globalScene;
    if (previous === scene) {
      this.onChange(`globalScene unchanged ${scene}`);
      return;
    }
    this.globalScene = scene;
    for (const id of this.states.keys()) {
      this.states.set(
        id,
        withOverlayLock({
          ...createInitialPerMonitorState(id),
        }),
      );
    }
    this.onChange(`globalScene ${previous} → ${scene}`);
  }

  private setOverlay(
    monitorId: number,
    overlay: LocalOverlay,
    patch: Partial<Pick<PerMonitorState, 'selectedImageId' | 'selectedCategoryId'>>,
  ): void {
    if (this.globalScene !== 'PRODUCT_LIST' && overlay !== 'NONE') {
      throw new Error(`localOverlay requires globalScene=PRODUCT_LIST (monitor ${monitorId})`);
    }
    const current = this.getMonitor(monitorId);
    if (overlay === 'IMAGE_ZOOM' && current.localOverlay !== 'NONE' && current.localOverlay !== 'IMAGE_ZOOM') {
      throw new Error(`OPEN_IMAGE_ZOOM requires localOverlay=NONE (monitor ${monitorId} is ${current.localOverlay})`);
    }
    if (overlay === 'CATEGORY_DRAWER' && current.localOverlay !== 'NONE' && current.localOverlay !== 'CATEGORY_DRAWER') {
      throw new Error(
        `OPEN_CATEGORY_DRAWER requires localOverlay=NONE (monitor ${monitorId} is ${current.localOverlay})`,
      );
    }
    if (overlay === 'CATEGORY_MODAL' && current.localOverlay !== 'CATEGORY_DRAWER' && current.localOverlay !== 'CATEGORY_MODAL') {
      throw new Error(
        `OPEN_CATEGORY_MODAL requires CATEGORY_DRAWER (monitor ${monitorId} is ${current.localOverlay})`,
      );
    }
    if (overlay === 'CATEGORY_MODAL') {
      const categoryId = patch.selectedCategoryId ?? current.selectedCategoryId;
      if (!categoryId) {
        throw new Error(`OPEN_CATEGORY_MODAL requires categoryId (monitor ${monitorId})`);
      }
      patch = { ...patch, selectedCategoryId: categoryId };
    }

    const next = withOverlayLock({
      ...current,
      localOverlay: overlay,
      selectedImageId: overlay === 'IMAGE_ZOOM' ? (patch.selectedImageId ?? current.selectedImageId) : null,
      selectedCategoryId:
        overlay === 'CATEGORY_MODAL'
          ? (patch.selectedCategoryId ?? current.selectedCategoryId)
          : overlay === 'NONE'
            ? null
            : overlay === 'CATEGORY_DRAWER'
              ? current.selectedCategoryId
              : null,
    });
    this.states.set(monitorId, next);
    this.onChange(
      `localOverlay monitor=${monitorId} ${current.localOverlay} → ${next.localOverlay} locked=${next.interactionLocked}`,
    );
  }

  static broadcastAll(
    windows: Map<number, BrowserWindow>,
    coordinator: ProductionStateCoordinator,
  ): void {
    for (const [monitorId, win] of windows) {
      if (win.isDestroyed()) continue;
      win.webContents.send('trunk:production-state-changed', coordinator.snapshotFor(monitorId));
    }
  }
}
