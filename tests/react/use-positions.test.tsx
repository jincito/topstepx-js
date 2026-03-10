import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TopstepXProvider } from '../../src/react/context.js';
import { usePositions } from '../../src/react/use-positions.js';

const mockSearchOpen = vi.fn();
const mockOnPosition = vi.fn();
const mockUnsub = vi.fn();

vi.mock('../../src/client/topstepx-client.js', () => ({
  TopstepXClient: class MockClient {
    positions = { searchOpen: mockSearchOpen };
    userHub = { onPosition: mockOnPosition };
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

describe('usePositions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnPosition.mockReturnValue(mockUnsub);
  });

  it('loads positions on mount', async () => {
    mockSearchOpen.mockResolvedValue([
      { id: 1, accountId: 100, contractId: 'CON1', type: 1, size: 5, averagePrice: 100.5 },
    ]);

    const { result } = renderHook(() => usePositions(100), { wrapper });

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([
      { id: 1, accountId: 100, contractId: 'CON1', type: 1, size: 5, averagePrice: 100.5 },
    ]);
    expect(result.current.error).toBeNull();
    expect(mockSearchOpen).toHaveBeenCalledWith({ accountId: 100 });
  });

  it('returns error on fetch failure', async () => {
    mockSearchOpen.mockRejectedValue(new Error('Connection failed'));

    const { result } = renderHook(() => usePositions(100), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error!.message).toBe('Connection failed');
    expect(result.current.data).toBeNull();
  });

  it('merges WS position update by contractId', async () => {
    mockSearchOpen.mockResolvedValue([
      { id: 1, accountId: 100, contractId: 'CON1', type: 1, size: 5, averagePrice: 100.5 },
    ]);

    const { result } = renderHook(() => usePositions(100), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const posCallback = mockOnPosition.mock.calls[0][0];

    act(() => {
      posCallback({ id: 1, accountId: 100, contractId: 'CON1', type: 1, size: 10, averagePrice: 101.0 });
    });

    await waitFor(() => {
      expect(result.current.data![0].size).toBe(10);
      expect(result.current.data![0].averagePrice).toBe(101.0);
    });
  });

  it('prepends new WS position', async () => {
    mockSearchOpen.mockResolvedValue([
      { id: 1, accountId: 100, contractId: 'CON1', type: 1, size: 5, averagePrice: 100.5 },
    ]);

    const { result } = renderHook(() => usePositions(100), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const posCallback = mockOnPosition.mock.calls[0][0];

    act(() => {
      posCallback({ id: 2, accountId: 100, contractId: 'CON2', type: 2, size: 3, averagePrice: 50.0 });
    });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data![0].contractId).toBe('CON2');
      expect(result.current.data![1].contractId).toBe('CON1');
    });
  });

  it('filters WS updates by accountId', async () => {
    mockSearchOpen.mockResolvedValue([
      { id: 1, accountId: 100, contractId: 'CON1', type: 1, size: 5, averagePrice: 100.5 },
    ]);

    const { result } = renderHook(() => usePositions(100), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const posCallback = mockOnPosition.mock.calls[0][0];

    act(() => {
      posCallback({ id: 3, accountId: 999, contractId: 'CON3', type: 1, size: 2, averagePrice: 75.0 });
    });

    expect(result.current.data).toHaveLength(1);
  });

  it('cleans up subscription on unmount', async () => {
    mockSearchOpen.mockResolvedValue([]);

    const { result, unmount } = renderHook(() => usePositions(100), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    unmount();

    expect(mockUnsub).toHaveBeenCalled();
  });
});
