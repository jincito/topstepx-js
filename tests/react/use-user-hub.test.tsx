import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HubConnectionState } from '@microsoft/signalr';
import { TopstepXProvider } from '../../src/react/context.js';
import { useUserHub } from '../../src/react/use-user-hub.js';

const mockUserHub = {
  state: HubConnectionState.Disconnected,
  start: vi.fn().mockImplementation(async () => {
    mockUserHub.state = HubConnectionState.Connected;
  }),
  stop: vi.fn(),
  subscribeAccounts: vi.fn().mockResolvedValue(undefined),
  unsubscribeAccounts: vi.fn().mockResolvedValue(undefined),
  subscribeOrders: vi.fn().mockResolvedValue(undefined),
  unsubscribeOrders: vi.fn().mockResolvedValue(undefined),
  subscribePositions: vi.fn().mockResolvedValue(undefined),
  unsubscribePositions: vi.fn().mockResolvedValue(undefined),
  subscribeTrades: vi.fn().mockResolvedValue(undefined),
  unsubscribeTrades: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../../src/client/topstepx-client.js', () => ({
  TopstepXClient: class MockClient {
    get userHub() {
      return mockUserHub;
    }
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

beforeEach(() => {
  mockUserHub.state = HubConnectionState.Disconnected;
  vi.clearAllMocks();
  mockUserHub.start.mockImplementation(async () => {
    mockUserHub.state = HubConnectionState.Connected;
  });
});

describe('useUserHub', () => {
  it('auto-starts hub when disconnected', async () => {
    const { result } = renderHook(() => useUserHub(), { wrapper });

    // Start is called because hub is disconnected
    await waitFor(() => {
      expect(mockUserHub.start).toHaveBeenCalled();
    });

    // Wait for the polling interval to pick up Connected state
    await waitFor(() => {
      expect(result.current.state).toBe(HubConnectionState.Connected);
    });
  });

  it('returns subscribe helpers that call hub methods', async () => {
    mockUserHub.state = HubConnectionState.Connected;

    const { result } = renderHook(() => useUserHub(), { wrapper });

    await act(async () => {
      await result.current.subscribeAccounts();
    });
    expect(mockUserHub.subscribeAccounts).toHaveBeenCalled();

    await act(async () => {
      await result.current.subscribeOrders(123);
    });
    expect(mockUserHub.subscribeOrders).toHaveBeenCalledWith(123);

    await act(async () => {
      await result.current.subscribePositions(456);
    });
    expect(mockUserHub.subscribePositions).toHaveBeenCalledWith(456);

    await act(async () => {
      await result.current.subscribeTrades(789);
    });
    expect(mockUserHub.subscribeTrades).toHaveBeenCalledWith(789);
  });

  it('returns unsubscribe helpers that call hub methods', async () => {
    mockUserHub.state = HubConnectionState.Connected;

    const { result } = renderHook(() => useUserHub(), { wrapper });

    await act(async () => {
      await result.current.unsubscribeAccounts();
    });
    expect(mockUserHub.unsubscribeAccounts).toHaveBeenCalled();

    await act(async () => {
      await result.current.unsubscribeOrders(123);
    });
    expect(mockUserHub.unsubscribeOrders).toHaveBeenCalledWith(123);

    await act(async () => {
      await result.current.unsubscribePositions(456);
    });
    expect(mockUserHub.unsubscribePositions).toHaveBeenCalledWith(456);

    await act(async () => {
      await result.current.unsubscribeTrades(789);
    });
    expect(mockUserHub.unsubscribeTrades).toHaveBeenCalledWith(789);
  });

  it('reports hub connection state', async () => {
    mockUserHub.state = HubConnectionState.Connected;

    const { result } = renderHook(() => useUserHub(), { wrapper });

    expect(result.current.state).toBe(HubConnectionState.Connected);
  });

  it('exposes the hub instance', () => {
    mockUserHub.state = HubConnectionState.Connected;

    const { result } = renderHook(() => useUserHub(), { wrapper });

    expect(result.current.hub).toBe(mockUserHub);
  });
});
