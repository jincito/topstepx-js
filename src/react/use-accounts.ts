import { useState, useEffect, useCallback, useRef } from 'react';
import { useTopstepX } from './context.js';
import type { QueryResult } from './types.js';
import type { Account } from '../types/index.js';

/**
 * Hook to fetch accounts from the TopstepX API.
 *
 * Fetches on mount and whenever `onlyActive` changes. Returns a standard
 * QueryResult with data, loading, error, and refetch.
 *
 * @param onlyActive - If true, only return active accounts (default: false)
 *
 * @example
 * ```tsx
 * const { data: accounts, loading, error, refetch } = useAccounts(true);
 * ```
 */
export function useAccounts(onlyActive?: boolean): QueryResult<Account[]> {
  const client = useTopstepX();
  const [data, setData] = useState<Account[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const accounts = await client.accounts.search({
        onlyActiveAccounts: onlyActive ?? false,
      });
      if (mountedRef.current) {
        setData(accounts);
        setLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    }
  }, [client, onlyActive]);

  useEffect(() => {
    mountedRef.current = true;
    fetch();
    return () => {
      mountedRef.current = false;
    };
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
