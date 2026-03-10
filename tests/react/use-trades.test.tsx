import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TopstepXProvider } from '../../src/react/context.js';
import { useTrades } from '../../src/react/use-trades.js';

const mockSearch = vi.fn();
const mockOnTrade = vi.fn();
const mockUnsub = vi.fn();

vi.mock('../../src/client/topstepx-client.js', () => ({
  TopstepXClient: class MockClient {
    trades = { search: mockSearch };
    userHub = { onTrade: mockOnTrade };
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

describe('useTrades', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnTrade.mockReturnValue(mockUnsub);
  });

  it('loads trades on mount', async () => {
    mockSearch.mockResolvedValue([
      { id: 1, accountId: 100, contractId: 'CON1', side: 1, size: 2, price: 50.0 },
    ]);

    const { result } = renderHook(() => useTrades(100, '2024-01-01'), { wrapper });

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([
      { id: 1, accountId: 100, contractId: 'CON1', side: 1, size: 2, price: 50.0 },
    ]);
    expect(result.current.error).toBeNull();
    expect(mockSearch).toHaveBeenCalledWith({
      accountId: 100,
      startTimestamp: '2024-01-01',
      endTimestamp: null,
    });
  });

  it('passes endTimestamp when provided', async () => {
    mockSearch.mockResolvedValue([]);

    const { result } = renderHook(
      () => useTrades(100, '2024-01-01', '2024-02-01'),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockSearch).toHaveBeenCalledWith({
      accountId: 100,
      startTimestamp: '2024-01-01',
      endTimestamp: '2024-02-01',
    });
  });

  it('returns error on fetch failure', async () => {
    mockSearch.mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() => useTrades(100, '2024-01-01'), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error!.message).toBe('Server error');
    expect(result.current.data).toBeNull();
  });

  it('merges WS trade update by id', async () => {
    mockSearch.mockResolvedValue([
      { id: 1, accountId: 100, contractId: 'CON1', side: 1, size: 2, price: 50.0 },
    ]);

    const { result } = renderHook(() => useTrades(100, '2024-01-01'), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const tradeCallback = mockOnTrade.mock.calls[0][0];

    act(() => {
      tradeCallback({ id: 1, accountId: 100, contractId: 'CON1', side: 1, size: 2, price: 55.0 });
    });

    await waitFor(() => {
      expect(result.current.data![0].price).toBe(55.0);
    });
  });

  it('prepends new WS trade', async () => {
    mockSearch.mockResolvedValue([
      { id: 1, accountId: 100, contractId: 'CON1', side: 1, size: 2, price: 50.0 },
    ]);

    const { result } = renderHook(() => useTrades(100, '2024-01-01'), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const tradeCallback = mockOnTrade.mock.calls[0][0];

    act(() => {
      tradeCallback({ id: 2, accountId: 100, contractId: 'CON2', side: 2, size: 1, price: 75.0 });
    });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data![0].id).toBe(2);
      expect(result.current.data![1].id).toBe(1);
    });
  });

  it('filters WS updates by accountId', async () => {
    mockSearch.mockResolvedValue([
      { id: 1, accountId: 100, contractId: 'CON1', side: 1, size: 2, price: 50.0 },
    ]);

    const { result } = renderHook(() => useTrades(100, '2024-01-01'), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const tradeCallback = mockOnTrade.mock.calls[0][0];

    act(() => {
      tradeCallback({ id: 3, accountId: 999, contractId: 'CON3', side: 1, size: 5, price: 30.0 });
    });

    expect(result.current.data).toHaveLength(1);
  });

  it('cleans up subscription on unmount', async () => {
    mockSearch.mockResolvedValue([]);

    const { result, unmount } = renderHook(() => useTrades(100, '2024-01-01'), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    unmount();

    expect(mockUnsub).toHaveBeenCalled();
  });
});
