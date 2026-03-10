import { useState, useEffect, useCallback } from 'react';
import { HubConnectionState } from '@microsoft/signalr';
import { useTopstepX } from './context.js';
import type { UserHub } from '../hubs/user-hub.js';

/** Return type for the useUserHub hook */
export interface UserHubHookResult {
  hub: UserHub;
  state: HubConnectionState;
  subscribeAccounts: () => Promise<void>;
  unsubscribeAccounts: () => Promise<void>;
  subscribeOrders: (accountId: number) => Promise<void>;
  unsubscribeOrders: (accountId: number) => Promise<void>;
  subscribePositions: (accountId: number) => Promise<void>;
  unsubscribePositions: (accountId: number) => Promise<void>;
  subscribeTrades: (accountId: number) => Promise<void>;
  unsubscribeTrades: (accountId: number) => Promise<void>;
}

/**
 * Hook to access the UserHub for real-time account, order, position,
 * and trade events.
 *
 * Auto-starts the hub if it is disconnected. Polls connection state
 * every second and exposes subscribe/unsubscribe helpers.
 *
 * The hub lifecycle is owned by the TopstepXProvider -- this hook does
 * NOT stop the hub on unmount.
 *
 * @example
 * ```tsx
 * const { hub, state, subscribeOrders, unsubscribeOrders } = useUserHub();
 *
 * useEffect(() => {
 *   subscribeOrders(accountId);
 *   return () => { unsubscribeOrders(accountId); };
 * }, [accountId]);
 *
 * hub.onOrder((order) => console.log(order));
 * ```
 */
export function useUserHub(): UserHubHookResult {
  const client = useTopstepX();
  const hub = client.userHub;
  const [state, setState] = useState<HubConnectionState>(hub.state);

  useEffect(() => {
    // Auto-start the hub if disconnected
    if (hub.state === HubConnectionState.Disconnected) {
      hub.start()
        .then(() => setState(hub.state))
        .catch(() => setState(hub.state));
    }

    // Poll connection state
    const interval = setInterval(() => {
      setState(hub.state);
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [hub]);

  const subscribeAccounts = useCallback(() => hub.subscribeAccounts(), [hub]);
  const unsubscribeAccounts = useCallback(() => hub.unsubscribeAccounts(), [hub]);
  const subscribeOrders = useCallback((accountId: number) => hub.subscribeOrders(accountId), [hub]);
  const unsubscribeOrders = useCallback((accountId: number) => hub.unsubscribeOrders(accountId), [hub]);
  const subscribePositions = useCallback((accountId: number) => hub.subscribePositions(accountId), [hub]);
  const unsubscribePositions = useCallback((accountId: number) => hub.unsubscribePositions(accountId), [hub]);
  const subscribeTrades = useCallback((accountId: number) => hub.subscribeTrades(accountId), [hub]);
  const unsubscribeTrades = useCallback((accountId: number) => hub.unsubscribeTrades(accountId), [hub]);

  return {
    hub,
    state,
    subscribeAccounts,
    unsubscribeAccounts,
    subscribeOrders,
    unsubscribeOrders,
    subscribePositions,
    unsubscribePositions,
    subscribeTrades,
    unsubscribeTrades,
  };
}
