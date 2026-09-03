import { createInitialMonitorState, type MonitorState } from '../../shared/state';
import { applyTransition, type StateAction } from '../../shared/transitions';

export class MonitorStateStore {
  private states = new Map<number, MonitorState>();

  constructor(monitorIds: number[]) {
    for (const id of monitorIds) {
      this.states.set(id, createInitialMonitorState(id));
    }
  }

  getAll(): MonitorState[] {
    return [...this.states.values()].sort((a, b) => a.monitorId - b.monitorId);
  }

  get(monitorId: number): MonitorState {
    const state = this.states.get(monitorId);
    if (!state) {
      throw new Error(`Unknown monitorId: ${monitorId}`);
    }
    return state;
  }

  set(monitorId: number, state: MonitorState): void {
    this.states.set(monitorId, state);
  }

  apply(monitorId: number, action: StateAction): MonitorState {
    const current = this.get(monitorId);
    const result = applyTransition(current, action);
    if (!result.ok) {
      throw new Error(result.reason);
    }
    this.set(monitorId, result.next);
    return result.next;
  }

  applyToMany(monitorIds: number[], action: StateAction): MonitorState[] {
    const updated: MonitorState[] = [];
    for (const id of monitorIds) {
      updated.push(this.apply(id, action));
    }
    return updated;
  }
}
