import {
  createInitialMonitorState,
  INITIAL_UI_STATE,
  type MonitorState,
  type ScreenState,
  type UiState,
} from './state';
import { isIdleTimeoutApplicable } from './idleConfig';

/** Renderer → Main へ送る状態遷移アクション */
export type StateAction =
  | { type: 'TOP_ENTRY_TAP' }
  | { type: 'ANIMATION_COMPLETE' }
  | { type: 'LIST_IMAGE_TAP'; imageId?: string }
  | { type: 'IMAGE_ZOOM_CLOSE' }
  | { type: 'CATEGORY_DRAWER_OPEN' }
  | { type: 'CATEGORY_DRAWER_CLOSE' }
  | { type: 'CATEGORY_SELECT'; categoryId: string }
  | { type: 'PRODUCT_DETAIL_CLOSE' }
  | { type: 'IDLE_TIMEOUT' };

export type TransitionResult =
  | { ok: true; next: MonitorState }
  | { ok: false; reason: string };

function closedUi(): UiState {
  return { ...INITIAL_UI_STATE };
}

function fail(state: MonitorState, expected: ScreenState, action: StateAction['type']): TransitionResult {
  return {
    ok: false,
    reason: `${action} requires screenState=${expected}, got ${state.screenState} (monitor ${state.monitorId})`,
  };
}

/** 単一モニターに対する純粋な状態遷移（同期判定は Main 側） */
export function applyTransition(state: MonitorState, action: StateAction): TransitionResult {
  switch (action.type) {
    case 'TOP_ENTRY_TAP': {
      if (state.screenState !== 'TOP') return fail(state, 'TOP', action.type);
      return {
        ok: true,
        next: {
          ...state,
          screenState: 'ANIMATION',
          uiState: closedUi(),
          selectedCategoryId: null,
          selectedListImageId: null,
        },
      };
    }

    case 'ANIMATION_COMPLETE': {
      if (state.screenState !== 'ANIMATION') return fail(state, 'ANIMATION', action.type);
      return {
        ok: true,
        next: {
          ...state,
          screenState: 'PRODUCT_LIST',
          uiState: closedUi(),
        },
      };
    }

    case 'LIST_IMAGE_TAP': {
      if (state.screenState !== 'PRODUCT_LIST') return fail(state, 'PRODUCT_LIST', action.type);
      return {
        ok: true,
        next: {
          ...state,
          screenState: 'IMAGE_ZOOM',
          uiState: closedUi(),
          selectedListImageId: action.imageId ?? 'test-image',
        },
      };
    }

    case 'IMAGE_ZOOM_CLOSE': {
      if (state.screenState !== 'IMAGE_ZOOM') return fail(state, 'IMAGE_ZOOM', action.type);
      return {
        ok: true,
        next: {
          ...state,
          screenState: 'PRODUCT_LIST',
          uiState: closedUi(),
          selectedListImageId: null,
        },
      };
    }

    case 'CATEGORY_DRAWER_OPEN': {
      if (state.screenState !== 'PRODUCT_LIST') return fail(state, 'PRODUCT_LIST', action.type);
      if (state.uiState.categoryDrawer === 'open') {
        return { ok: false, reason: 'categoryDrawer already open' };
      }
      return {
        ok: true,
        next: {
          ...state,
          uiState: { categoryDrawer: 'open' },
        },
      };
    }

    case 'CATEGORY_DRAWER_CLOSE': {
      if (state.screenState !== 'PRODUCT_LIST') return fail(state, 'PRODUCT_LIST', action.type);
      if (state.uiState.categoryDrawer !== 'open') {
        return { ok: false, reason: 'categoryDrawer not open' };
      }
      return {
        ok: true,
        next: {
          ...state,
          uiState: closedUi(),
        },
      };
    }

    case 'CATEGORY_SELECT': {
      if (state.screenState !== 'PRODUCT_LIST') return fail(state, 'PRODUCT_LIST', action.type);
      if (state.uiState.categoryDrawer !== 'open') {
        return { ok: false, reason: 'categoryDrawer must be open to select category' };
      }
      if (!action.categoryId) {
        return { ok: false, reason: 'categoryId required' };
      }
      return {
        ok: true,
        next: {
          ...state,
          screenState: 'PRODUCT_DETAIL',
          uiState: closedUi(),
          selectedCategoryId: action.categoryId,
        },
      };
    }

    case 'PRODUCT_DETAIL_CLOSE': {
      if (state.screenState !== 'PRODUCT_DETAIL') return fail(state, 'PRODUCT_DETAIL', action.type);
      return {
        ok: true,
        next: {
          ...state,
          screenState: 'PRODUCT_LIST',
          uiState: closedUi(),
          selectedCategoryId: null,
        },
      };
    }

    case 'IDLE_TIMEOUT': {
      if (!isIdleTimeoutApplicable(state.screenState)) {
        return {
          ok: false,
          reason: `${action.type} not applicable in screenState=${state.screenState} (monitor ${state.monitorId})`,
        };
      }
      return { ok: true, next: createInitialMonitorState(state.monitorId) };
    }

    default: {
      const _exhaustive: never = action;
      return { ok: false, reason: `unknown action: ${String(_exhaustive)}` };
    }
  }
}

/** 全モニターが TOP かどうか（4面同期開始条件） */
export function allMonitorsTop(states: MonitorState[]): boolean {
  return states.length > 0 && states.every((s) => s.screenState === 'TOP');
}

export function resetMonitorState(monitorId: number): MonitorState {
  return createInitialMonitorState(monitorId);
}
