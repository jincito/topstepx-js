import { useState, useEffect, useCallback, useRef } from 'react';
import { useTopstepX } from './context.js';
import type { QueryResult } from './types.js';
import type { Contract } from '../types/index.js';

/**
 * Hook to fetch available contracts from the TopstepX API.
 *
 * Fetches on mount and whenever `live` changes. Returns a standard
 * QueryResult with data, loading, error, and refetch.
 *
 * @param live - If true, fetch only live contracts (default: false)
 *
 * @example
 * ```tsx
 * const { data: contracts, loading, error, refetch } = useContracts(true);
 * ```
 */
export function useContracts(live?: boolean): QueryResult<Contract[]> {
  const client = useTopstepX();
  const [data, setData] = useState<Contract[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const contracts = await client.contracts.available({
        live: live ?? false,
      });
      if (mountedRef.current) {
        setData(contracts);
        setLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    }
  }, [client, live]);

  useEffect(() => {
    mountedRef.current = true;
    fetch();
    return () => {
      mountedRef.current = false;
    };
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
