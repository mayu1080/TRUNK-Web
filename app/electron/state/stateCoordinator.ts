import type { BrowserWindow } from 'electron';
import { allMonitorsTop } from '../../shared/transitions';
import type { StateAction } from '../../shared/transitions';
import type { MonitorState } from '../../shared/state';
import { MonitorStateStore } from './monitorStateStore';

export type StateChangeListener = (monitorId: number, state: MonitorState) => void;

/**
 * Main process 中央状態管理。
 * - TOP→ANIMATION→PRODUCT_LIST: 4台すべて TOP のときのみ4面同期
 * - それ以外: 当該モニターのみ更新（他モニターを中断しない）
 */
export class StateCoordinator {
  /** ANIMATION 同期グループ（同期開始時に記録、PRODUCT_LIST 到達後に解除） */
  private syncGroups = new Map<number, number[]>();

  constructor(
    private store: MonitorStateStore,
    private onStateChange: StateChangeListener,
  ) {}

  getState(monitorId: number): MonitorState {
    return this.store.get(monitorId);
  }

  getAllStates(): MonitorState[] {
    return this.store.getAll();
  }

  dispatch(monitorId: number, action: StateAction): MonitorState {
    switch (action.type) {
      case 'TOP_ENTRY_TAP':
        return this.handleTopEntryTap(monitorId);
      case 'ANIMATION_COMPLETE':
        return this.handleAnimationComplete(monitorId);
      case 'IDLE_TIMEOUT':
        return this.handleIdleTimeout(monitorId);
      default:
        return this.handleLocalAction(monitorId, action);
    }
  }

  private handleTopEntryTap(monitorId: number): MonitorState {
    const action: StateAction = { type: 'TOP_ENTRY_TAP' };
    const all = this.store.getAll();
    const syncAll = allMonitorsTop(all);

    if (syncAll) {
      const ids = all.map((s) => s.monitorId);
      for (const id of ids) {
        this.syncGroups.set(id, ids);
      }
      const updated = this.store.applyToMany(ids, action);
      for (const state of updated) {
        this.onStateChange(state.monitorId, state);
      }
      return this.store.get(monitorId);
    }

    this.syncGroups.set(monitorId, [monitorId]);
    const next = this.store.apply(monitorId, action);
    this.onStateChange(monitorId, next);
    return next;
  }

  private handleAnimationComplete(monitorId: number): MonitorState {
    const group = this.syncGroups.get(monitorId) ?? [monitorId];
    const targets = group.filter((id) => this.store.get(id).screenState === 'ANIMATION');

    const updated: MonitorState[] = [];
    for (const id of targets) {
      updated.push(this.store.apply(id, { type: 'ANIMATION_COMPLETE' }));
    }

    for (const state of updated) {
      this.onStateChange(state.monitorId, state);
      this.syncGroups.delete(state.monitorId);
    }

    return this.store.get(monitorId);
  }

  private handleLocalAction(monitorId: number, action: StateAction): MonitorState {
    const next = this.store.apply(monitorId, action);
    this.onStateChange(monitorId, next);
    return next;
  }

  /** 無操作スリープ: 当該モニターのみ TOP へ（他モニター・同期グループに影響しない） */
  private handleIdleTimeout(monitorId: number): MonitorState {
    this.syncGroups.delete(monitorId);
    const next = this.store.apply(monitorId, { type: 'IDLE_TIMEOUT' });
    this.onStateChange(monitorId, next);
    return next;
  }

  /** 各 BrowserWindow へ状態変更を通知 */
  static broadcast(
    windows: Map<number, BrowserWindow>,
    monitorId: number,
    state: MonitorState,
  ): void {
    const win = windows.get(monitorId);
    if (win && !win.isDestroyed()) {
      win.webContents.send('trunk:state-changed', state);
    }
  }
}
