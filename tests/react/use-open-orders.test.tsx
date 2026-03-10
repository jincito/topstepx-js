import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TopstepXProvider } from '../../src/react/context.js';
import { useOpenOrders } from '../../src/react/use-open-orders.js';

const mockSearchOpen = vi.fn();
const mockOnOrder = vi.fn();
const mockUnsub = vi.fn();

vi.mock('../../src/client/topstepx-client.js', () => ({
  TopstepXClient: class MockClient {
    orders = { searchOpen: mockSearchOpen };
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

describe('useOpenOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnOrder.mockReturnValue(mockUnsub);
  });

  it('loads open orders on mount', async () => {
    mockSearchOpen.mockResolvedValue([
      { id: 1, accountId: 100, contractId: 'CON1', status: 2 },
    ]);

    const { result } = renderHook(() => useOpenOrders(100), { wrapper });

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([
      { id: 1, accountId: 100, contractId: 'CON1', status: 2 },
    ]);
    expect(result.current.error).toBeNull();
    expect(mockSearchOpen).toHaveBeenCalledWith({ accountId: 100 });
  });

  it('returns error on fetch failure', async () => {
    mockSearchOpen.mockRejectedValue(new Error('API error'));

    const { result } = renderHook(() => useOpenOrders(100), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error!.message).toBe('API error');
    expect(result.current.data).toBeNull();
  });

  it('merges WS order update into data', async () => {
    mockSearchOpen.mockResolvedValue([
      { id: 1, accountId: 100, contractId: 'CON1', status: 2, size: 5 },
    ]);

    const { result } = renderHook(() => useOpenOrders(100), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const orderCallback = mockOnOrder.mock.calls[0][0];

    act(() => {
      orderCallback({ id: 1, accountId: 100, contractId: 'CON1', status: 3, size: 10 });
    });

    await waitFor(() => {
      expect(result.current.data![0].status).toBe(3);
      expect(result.current.data![0].size).toBe(10);
    });
  });

  it('prepends new WS order', async () => {
    mockSearchOpen.mockResolvedValue([
      { id: 1, accountId: 100, contractId: 'CON1', status: 2 },
    ]);

    const { result } = renderHook(() => useOpenOrders(100), { wrapper });

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
    mockSearchOpen.mockResolvedValue([
      { id: 1, accountId: 100, contractId: 'CON1', status: 2 },
    ]);

    const { result } = renderHook(() => useOpenOrders(100), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const orderCallback = mockOnOrder.mock.calls[0][0];

    act(() => {
      orderCallback({ id: 3, accountId: 999, contractId: 'CON3', status: 1 });
    });

    expect(result.current.data).toHaveLength(1);
  });

  it('cleans up subscription on unmount', async () => {
    mockSearchOpen.mockResolvedValue([]);

    const { result, unmount } = renderHook(() => useOpenOrders(100), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    unmount();

    expect(mockUnsub).toHaveBeenCalled();
  });
});
