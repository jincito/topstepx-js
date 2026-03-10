import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TopstepXProvider } from '../../src/react/context.js';
import { useBars } from '../../src/react/use-bars.js';

const mockGetBars = vi.fn();

vi.mock('../../src/client/topstepx-client.js', () => ({
  TopstepXClient: class MockClient {
    getBars = mockGetBars;
    disconnect = vi.fn();
  },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <TopstepXProvider credentials={{ userName: 'test', apiKey: 'key' }}>
      {children}
    </TopstepXProvider>
  );
}

describe('useBars', () => {
  it('returns loading=true initially, then data after fetch', async () => {
    mockGetBars.mockResolvedValue([
      { timestamp: '2024-01-01T00:00:00Z', open: 5000, high: 5010, low: 4990, close: 5005, volume: 100 },
    ]);

    const { result } = renderHook(() => useBars('CON.F.US.ESH5'), { wrapper });

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([
      { timestamp: '2024-01-01T00:00:00Z', open: 5000, high: 5010, low: 4990, close: 5005, volume: 100 },
    ]);
    expect(result.current.error).toBeNull();
    expect(mockGetBars).toHaveBeenCalledWith('CON.F.US.ESH5', undefined);
  });

  it('passes options to getBars', async () => {
    mockGetBars.mockResolvedValue([]);

    const options = { limit: 50, live: true };
    const { result } = renderHook(() => useBars('CON.F.US.ESH5', options), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetBars).toHaveBeenCalledWith('CON.F.US.ESH5', options);
  });

  it('returns error on fetch failure', async () => {
    mockGetBars.mockRejectedValue(new Error('History unavailable'));

    const { result } = renderHook(() => useBars('CON.F.US.ESH5'), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error!.message).toBe('History unavailable');
    expect(result.current.data).toBeNull();
  });

  it('refetch triggers a new fetch', async () => {
    mockGetBars
      .mockResolvedValueOnce([{ timestamp: '2024-01-01', open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }])
      .mockResolvedValueOnce([{ timestamp: '2024-01-02', open: 2, high: 3, low: 1.5, close: 2.5, volume: 20 }]);

    const { result } = renderHook(() => useBars('CON.F.US.ESH5'), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data![0].timestamp).toBe('2024-01-01');

    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.data![0].timestamp).toBe('2024-01-02');
    });
  });
});
