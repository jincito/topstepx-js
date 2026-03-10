import { useState, useEffect, useCallback, useRef } from 'react';
import { useTopstepX } from './context.js';
import type { QueryResult } from './types.js';
import type { Bar } from '../types/index.js';
import type { GetBarsOptions } from '../types/client.js';

/**
 * Hook to fetch historical bars from the TopstepX API.
 *
 * Fetches on mount and whenever contractId or options change. Uses primitive
 * values from options in the dependency array to avoid infinite re-renders
 * from new object references.
 *
 * @param contractId - The contract to fetch bars for
 * @param options - Optional bar retrieval options (live, startTime, endTime, unit, etc.)
 *
 * @example
 * ```tsx
 * const { data: bars, loading, error, refetch } = useBars('CON.F.US.ESH5', {
 *   unit: BarUnit.Minute,
 *   unitNumber: 5,
 *   limit: 100,
 * });
 * ```
 */
export function useBars(contractId: string, options?: Partial<GetBarsOptions>): QueryResult<Bar[]> {
  const client = useTopstepX();
  const [data, setData] = useState<Bar[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  // Extract primitive values for dependency array to avoid infinite re-renders
  const live = options?.live;
  const startTimeMs = options?.startTime?.getTime();
  const endTimeMs = options?.endTime?.getTime();
  const unit = options?.unit;
  const unitNumber = options?.unitNumber;
  const limit = options?.limit;
  const includePartialBar = options?.includePartialBar;

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const bars = await client.getBars(contractId, options);
      if (mountedRef.current) {
        setData(bars);
        setLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, contractId, live, startTimeMs, endTimeMs, unit, unitNumber, limit, includePartialBar]);

  useEffect(() => {
    mountedRef.current = true;
    fetch();
    return () => {
      mountedRef.current = false;
    };
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
