import { useReducer, useEffect, useCallback, useRef } from 'react';
import { useTopstepX } from './context.js';
import type { Order } from '../types/index.js';
import type { GatewayUserOrder } from '../types/events.js';
import type { QueryResult } from './types.js';

type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; data: Order[] }
  | { type: 'FETCH_ERROR'; error: Error }
  | { type: 'WS_UPDATE'; item: Order };

interface State {
  data: Order[] | null;
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
      const idx = state.data.findIndex((o) => o.id === action.item.id);
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
 * Hook that fetches open orders via REST and merges real-time WebSocket updates.
 *
 * Uses `useReducer` for predictable state transitions when REST and WS data merge.
 * Existing orders are updated by `id`, new orders are prepended. Events are
 * filtered by `accountId`.
 *
 * @param accountId - Account to fetch open orders for
 *
 * @example
 * ```tsx
 * const { data: openOrders, loading, error, refetch } = useOpenOrders(100);
 * ```
 */
export function useOpenOrders(accountId: number): QueryResult<Order[]> {
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
      const orders = await client.orders.searchOpen({ accountId });
      dispatch({ type: 'FETCH_SUCCESS', data: orders });
    } catch (err) {
      dispatch({
        type: 'FETCH_ERROR',
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }, [client, accountId]);

  useEffect(() => {
    fetch();
    const unsub = client.userHub.onOrder((order: GatewayUserOrder) => {
      if (order.accountId === accountId) {
        dispatchRef.current({ type: 'WS_UPDATE', item: order as unknown as Order });
      }
    });
    return () => {
      unsub();
    };
  }, [fetch, client, accountId]);

  return { ...state, refetch: fetch };
}
