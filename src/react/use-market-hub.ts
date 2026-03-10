import { useState, useEffect, useCallback } from 'react';
import { HubConnectionState } from '@microsoft/signalr';
import { useTopstepX } from './context.js';
import type { MarketHub } from '../hubs/market-hub.js';

/** Return type for the useMarketHub hook */
export interface MarketHubHookResult {
  hub: MarketHub;
  state: HubConnectionState;
  subscribeQuotes: (contractId: number) => Promise<void>;
  unsubscribeQuotes: (contractId: number) => Promise<void>;
  subscribeTrades: (contractId: number) => Promise<void>;
  unsubscribeTrades: (contractId: number) => Promise<void>;
  subscribeDepth: (contractId: number) => Promise<void>;
  unsubscribeDepth: (contractId: number) => Promise<void>;
}

/**
 * Hook to access the MarketHub for real-time quote, trade,
 * and depth of market events.
 *
 * Auto-starts the hub if it is disconnected. Polls connection state
 * every second and exposes subscribe/unsubscribe helpers.
 *
 * The hub lifecycle is owned by the TopstepXProvider -- this hook does
 * NOT stop the hub on unmount.
 *
 * @example
 * ```tsx
 * const { hub, state, subscribeQuotes, unsubscribeQuotes } = useMarketHub();
 *
 * useEffect(() => {
 *   subscribeQuotes(contractId);
 *   return () => { unsubscribeQuotes(contractId); };
 * }, [contractId]);
 *
 * hub.onQuote((quote) => console.log(quote));
 * ```
 */
export function useMarketHub(): MarketHubHookResult {
  const client = useTopstepX();
  const hub = client.marketHub;
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

  const subscribeQuotes = useCallback((contractId: number) => hub.subscribeQuotes(contractId), [hub]);
  const unsubscribeQuotes = useCallback((contractId: number) => hub.unsubscribeQuotes(contractId), [hub]);
  const subscribeTrades = useCallback((contractId: number) => hub.subscribeTrades(contractId), [hub]);
  const unsubscribeTrades = useCallback((contractId: number) => hub.unsubscribeTrades(contractId), [hub]);
  const subscribeDepth = useCallback((contractId: number) => hub.subscribeDepth(contractId), [hub]);
  const unsubscribeDepth = useCallback((contractId: number) => hub.unsubscribeDepth(contractId), [hub]);

  return {
    hub,
    state,
    subscribeQuotes,
    unsubscribeQuotes,
    subscribeTrades,
    unsubscribeTrades,
    subscribeDepth,
    unsubscribeDepth,
  };
}
