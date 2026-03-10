import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TopstepXProvider } from '../../src/react/context.js';
import { useOrders } from '../../src/react/use-orders.js';

const mockSearch = vi.fn();
const mockOnOrder = vi.fn();
const mockUnsub = vi.fn();

vi.mock('../../src/client/topstepx-client.js', () => ({
  TopstepXClient: class MockClient {
    orders = { search: mockSearch };
    userHub = { onOrder: mockOnOrder };
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

describe('useOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnOrder.mockReturnValue(mockUnsub);
  });

  it('loads orders on mount', async () => {
    mockSearch.mockResolvedValue([
      { id: 1, accountId: 100, contractId: 'CON1', status: 2 },
    ]);

    const { result } = renderHook(() => useOrders(100, '2024-01-01'), { wrapper });

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([
      { id: 1, accountId: 100, contractId: 'CON1', status: 2 },
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
      () => useOrders(100, '2024-01-01', '2024-02-01'),
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
    mockSearch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useOrders(100, '2024-01-01'), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error!.message).toBe('Network error');
    expect(result.current.data).toBeNull();
  });

  it('merges WS order update into data', async () => {
    mockSearch.mockResolvedValue([
      { id: 1, accountId: 100, contractId: 'CON1', status: 2 },
    ]);

    const { result } = renderHook(() => useOrders(100, '2024-01-01'), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Capture the onOrder callback
    const orderCallback = mockOnOrder.mock.calls[0][0];

    // Dispatch a WS update for the same order with updated status
    act(() => {
      orderCallback({ id: 1, accountId: 100, contractId: 'CON1', status: 3 });
    });

    await waitFor(() => {
      expect(result.current.data![0].status).toBe(3);
    });
  });

  it('prepends new WS order', async () => {
    mockSearch.mockResolvedValue([
      { id: 1, accountId: 100, contractId: 'CON1', status: 2 },
    ]);

    const { result } = renderHook(() => useOrders(100, '2024-01-01'), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const orderCallback = mockOnOrder.mock.calls[0][0];

    act(() => {
      orderCallback({ id: 2, accountId: 100, contractId: 'CON2', status: 1 });
    });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data![0].id).toBe(2);
      expect(result.current.data![1].id).toBe(1);
    });
  });

  it('filters WS updates by accountId', async () => {
    mockSearch.mockResolvedValue([
      { id: 1, accountId: 100, contractId: 'CON1', status: 2 },
    ]);

    const { result } = renderHook(() => useOrders(100, '2024-01-01'), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const orderCallback = mockOnOrder.mock.calls[0][0];

    // Send an update for a different accountId
    act(() => {
      orderCallback({ id: 3, accountId: 999, contractId: 'CON3', status: 1 });
    });

    // Data should still have only 1 order
    expect(result.current.data).toHaveLength(1);
  });

  it('cleans up subscription on unmount', async () => {
    mockSearch.mockResolvedValue([]);

    const { result, unmount } = renderHook(() => useOrders(100, '2024-01-01'), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    unmount();

    expect(mockUnsub).toHaveBeenCalled();
  });
});
