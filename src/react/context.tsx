import { createContext, useContext, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { TopstepXClient, createClient } from '../client/topstepx-client.js';
import type { TopstepXConfig, TopstepXOptions } from '../types/config.js';

/** Context value holding the TopstepXClient instance */
interface TopstepXContextValue {
  client: TopstepXClient;
}

/** React context for TopstepXClient. Exported for testing only. */
export const TopstepXContext = createContext<TopstepXContextValue | null>(null);

/** Props for TopstepXProvider -- Supabase-style or legacy credentials format */
interface TopstepXProviderProps extends TopstepXOptions {
  children: ReactNode;
  /** @deprecated Use userName and apiKey props instead */
  credentials?: TopstepXConfig['credentials'];
  /** Your TopstepX username (Supabase-style) */
  userName?: string;
  /** Your TopstepX API key (Supabase-style) */
  apiKey?: string;
}

/**
 * Provider that creates a TopstepXClient from config and makes it
 * available to all child hooks via React context.
 *
 * The client is created once (never recreated on re-renders) and
 * disconnected on unmount.
 *
 * Supports both Supabase-style props (userName, apiKey) and legacy credentials object.
 *
 * @example
 * ```tsx
 * // Supabase-style (recommended)
 * <TopstepXProvider userName="user" apiKey="key">
 *   <App />
 * </TopstepXProvider>
 *
 * // Legacy format
 * <TopstepXProvider credentials={{ userName: 'user', apiKey: 'key' }}>
 *   <App />
 * </TopstepXProvider>
 * ```
 */
export function TopstepXProvider({ children, credentials, userName, apiKey, ...options }: TopstepXProviderProps) {
  const clientRef = useRef<TopstepXClient | null>(null);

  if (!clientRef.current) {
    if (userName && apiKey) {
      // Supabase-style
      clientRef.current = createClient(userName, apiKey, options);
    } else if (credentials) {
      // Legacy format
      clientRef.current = new TopstepXClient({ credentials, ...options });
    } else {
      throw new Error('TopstepXProvider requires either userName + apiKey props or credentials prop');
    }
  }

  const value = useMemo(() => ({ client: clientRef.current! }), []);

  useEffect(() => {
    return () => {
      clientRef.current?.disconnect();
    };
  }, []);

  return (
    <TopstepXContext.Provider value={value}>
      {children}
    </TopstepXContext.Provider>
  );
}

/**
 * Hook to access the TopstepXClient from the nearest TopstepXProvider.
 * Throws if used outside a provider.
 */
export function useTopstepX(): TopstepXClient {
  const ctx = useContext(TopstepXContext);
  if (!ctx) {
    throw new Error('useTopstepX must be used within a TopstepXProvider');
  }
  return ctx.client;
}
