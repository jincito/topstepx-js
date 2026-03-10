import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TopstepXProvider } from '../../src/react/context.js';
import { useContracts } from '../../src/react/use-contracts.js';

const mockAvailable = vi.fn();

vi.mock('../../src/client/topstepx-client.js', () => ({
  TopstepXClient: class MockClient {
    contracts = { available: mockAvailable };
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

describe('useContracts', () => {
  it('returns loading=true initially, then data after fetch', async () => {
    mockAvailable.mockResolvedValue([
      { id: 'CON.F.US.ESH5', name: 'ESH5', description: 'E-mini S&P 500', tickSize: 0.25, tickValue: 12.5, activeContract: true, symbolId: 'ES' },
    ]);

    const { result } = renderHook(() => useContracts(), { wrapper });

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([
      { id: 'CON.F.US.ESH5', name: 'ESH5', description: 'E-mini S&P 500', tickSize: 0.25, tickValue: 12.5, activeContract: true, symbolId: 'ES' },
    ]);
    expect(result.current.error).toBeNull();
    expect(mockAvailable).toHaveBeenCalledWith({ live: false });
  });

  it('passes live=true to available', async () => {
    mockAvailable.mockResolvedValue([]);

    const { result } = renderHook(() => useContracts(true), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockAvailable).toHaveBeenCalledWith({ live: true });
  });

  it('returns error on fetch failure', async () => {
    mockAvailable.mockRejectedValue(new Error('API unavailable'));

    const { result } = renderHook(() => useContracts(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error!.message).toBe('API unavailable');
    expect(result.current.data).toBeNull();
  });

  it('refetch triggers a new fetch', async () => {
    mockAvailable
      .mockResolvedValueOnce([{ id: 'CON.F.US.ESH5', name: 'ESH5', description: 'First', tickSize: 0.25, tickValue: 12.5, activeContract: true, symbolId: 'ES' }])
      .mockResolvedValueOnce([{ id: 'CON.F.US.NQH5', name: 'NQH5', description: 'Second', tickSize: 0.25, tickValue: 5, activeContract: true, symbolId: 'NQ' }]);

    const { result } = renderHook(() => useContracts(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data![0].name).toBe('ESH5');

    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.data![0].name).toBe('NQH5');
    });
  });
});
