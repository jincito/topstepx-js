import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TopstepXProvider } from '../../src/react/context.js';
import { useAccounts } from '../../src/react/use-accounts.js';

const mockSearch = vi.fn();

vi.mock('../../src/client/topstepx-client.js', () => ({
  TopstepXClient: class MockClient {
    accounts = { search: mockSearch };
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

describe('useAccounts', () => {
  it('returns loading=true initially, then data after fetch', async () => {
    mockSearch.mockResolvedValue([
      { id: 1, name: 'Test Account', balance: 50000, canTrade: true, isVisible: true },
    ]);

    const { result } = renderHook(() => useAccounts(), { wrapper });

    // Initially loading
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([
      { id: 1, name: 'Test Account', balance: 50000, canTrade: true, isVisible: true },
    ]);
    expect(result.current.error).toBeNull();
    expect(mockSearch).toHaveBeenCalledWith({ onlyActiveAccounts: false });
  });

  it('passes onlyActive=true to search', async () => {
    mockSearch.mockResolvedValue([]);

    const { result } = renderHook(() => useAccounts(true), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockSearch).toHaveBeenCalledWith({ onlyActiveAccounts: true });
  });

  it('returns error on fetch failure', async () => {
    mockSearch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useAccounts(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error!.message).toBe('Network error');
    expect(result.current.data).toBeNull();
  });

  it('refetch triggers a new fetch', async () => {
    mockSearch
      .mockResolvedValueOnce([{ id: 1, name: 'First', balance: 100, canTrade: true, isVisible: true }])
      .mockResolvedValueOnce([{ id: 2, name: 'Second', balance: 200, canTrade: true, isVisible: true }]);

    const { result } = renderHook(() => useAccounts(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([
      { id: 1, name: 'First', balance: 100, canTrade: true, isVisible: true },
    ]);

    // Trigger refetch
    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.data).toEqual([
        { id: 2, name: 'Second', balance: 200, canTrade: true, isVisible: true },
      ]);
    });
  });
});
