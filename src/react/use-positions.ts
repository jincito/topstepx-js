import { useReducer, useEffect, useCallback, useRef } from 'react';
import { useTopstepX } from './context.js';
import type { Position } from '../types/index.js';
import type { GatewayUserPosition } from '../types/events.js';
import type { QueryResult } from './types.js';

type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; data: Position[] }
  | { type: 'FETCH_ERROR'; error: Error }
  | { type: 'WS_UPDATE'; item: Position };

interface State {
  data: Position[] | null;
  loading: boolean;
  error: Error | null;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS':
      return { data: action.data, loading: false, error: null };
    case 'FETCH_ERROR':
      return { data: null, loading: false, error: action.error };
    case 'WS_UPDATE': {
      if (state.data === null) return state;
      // Positions are keyed by contractId (not numeric id)
      const idx = state.data.findIndex((p) => p.contractId === action.item.contractId);
      if (idx >= 0) {
        const updated = [...state.data];
        updated[idx] = { ...updated[idx], ...action.item };
        return { ...state, data: updated };
      }
      return { ...state, data: [action.item, ...state.data] };
    }
    default:
      return state;
  }
}

/**
 * Hook that fetches open positions via REST and merges real-time WebSocket updates.
 *
 * Uses `useReducer` for predictable state transitions when REST and WS data merge.
 * Existing positions are updated by `contractId`, new positions are prepended.
 * Events are filtered by `accountId`.
 *
 * @param accountId - Account to fetch positions for
 *
 * @example
 * ```tsx
 * const { data: positions, loading, error, refetch } = usePositions(100);
 * ```
 */
export function usePositions(accountId: number): QueryResult<Position[]> {
  const client = useTopstepX();
  const [state, dispatch] = useReducer(reducer, {
    data: null,
    loading: true,
    error: null,
  });

  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  const fetch = useCallback(async () => {
    dispatch({ type: 'FETCH_START' });
    try {
      const positions = await client.positions.searchOpen({ accountId });
      dispatch({ type: 'FETCH_SUCCESS', data: positions });
    } catch (err) {
      dispatch({
        type: 'FETCH_ERROR',
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }, [client, accountId]);

  useEffect(() => {
    fetch();
    const unsub = client.userHub.onPosition((position: GatewayUserPosition) => {
      if (position.accountId === accountId) {
        dispatchRef.current({ type: 'WS_UPDATE', item: position as unknown as Position });
      }
    });
    return () => {
      unsub();
    };
  }, [fetch, client, accountId]);

  return { ...state, refetch: fetch };
}
