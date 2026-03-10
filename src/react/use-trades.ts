import { useReducer, useEffect, useCallback, useRef } from 'react';
import { useTopstepX } from './context.js';
import type { Trade } from '../types/index.js';
import type { GatewayUserTrade } from '../types/events.js';
import type { QueryResult } from './types.js';

type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; data: Trade[] }
  | { type: 'FETCH_ERROR'; error: Error }
  | { type: 'WS_UPDATE'; item: Trade };

interface State {
  data: Trade[] | null;
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
      const idx = state.data.findIndex((t) => t.id === action.item.id);
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
 * Hook that fetches trades via REST and merges real-time WebSocket updates.
 *
 * Uses `useReducer` for predictable state transitions when REST and WS data merge.
 * Existing trades are updated by `id`, new trades are prepended. Events are
 * filtered by `accountId`.
 *
 * @param accountId - Account to fetch trades for
 * @param startTimestamp - Start of time range (ISO string)
 * @param endTimestamp - Optional end of time range (ISO string)
 *
 * @example
 * ```tsx
 * const { data: trades, loading, error, refetch } = useTrades(100, '2024-01-01');
 * ```
 */
export function useTrades(
  accountId: number,
  startTimestamp: string,
  endTimestamp?: string,
): QueryResult<Trade[]> {
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
      const trades = await client.trades.search({
        accountId,
        startTimestamp,
        endTimestamp: endTimestamp ?? null,
      });
      dispatch({ type: 'FETCH_SUCCESS', data: trades });
    } catch (err) {
      dispatch({
        type: 'FETCH_ERROR',
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }, [client, accountId, startTimestamp, endTimestamp]);

  useEffect(() => {
    fetch();
    const unsub = client.userHub.onTrade((trade: GatewayUserTrade) => {
      if (trade.accountId === accountId) {
        dispatchRef.current({ type: 'WS_UPDATE', item: trade as unknown as Trade });
      }
    });
    return () => {
      unsub();
    };
  }, [fetch, client, accountId]);

  return { ...state, refetch: fetch };
}
