import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HubConnectionState } from '@microsoft/signalr';
import { TopstepXProvider } from '../../src/react/context.js';
import { useMarketHub } from '../../src/react/use-market-hub.js';

const mockMarketHub = {
  state: HubConnectionState.Disconnected,
  start: vi.fn().mockImplementation(async () => {
    mockMarketHub.state = HubConnectionState.Connected;
  }),
  stop: vi.fn(),
  subscribeQuotes: vi.fn().mockResolvedValue(undefined),
  unsubscribeQuotes: vi.fn().mockResolvedValue(undefined),
  subscribeTrades: vi.fn().mockResolvedValue(undefined),
  unsubscribeTrades: vi.fn().mockResolvedValue(undefined),
  subscribeDepth: vi.fn().mockResolvedValue(undefined),
  unsubscribeDepth: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../../src/client/topstepx-client.js', () => ({
  TopstepXClient: class MockClient {
    get marketHub() {
      return mockMarketHub;
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
  mockMarketHub.state = HubConnectionState.Disconnected;
  vi.clearAllMocks();
  mockMarketHub.start.mockImplementation(async () => {
    mockMarketHub.state = HubConnectionState.Connected;
  });
});

describe('useMarketHub', () => {
  it('auto-starts hub when disconnected', async () => {
    const { result } = renderHook(() => useMarketHub(), { wrapper });

    await waitFor(() => {
      expect(mockMarketHub.start).toHaveBeenCalled();
    });

    // Wait for the polling interval to pick up Connected state
    await waitFor(() => {
      expect(result.current.state).toBe(HubConnectionState.Connected);
    });
  });

  it('returns subscribe helpers that call hub methods', async () => {
    mockMarketHub.state = HubConnectionState.Connected;

    const { result } = renderHook(() => useMarketHub(), { wrapper });

    await act(async () => {
      await result.current.subscribeQuotes(100);
    });
    expect(mockMarketHub.subscribeQuotes).toHaveBeenCalledWith(100);

    await act(async () => {
      await result.current.subscribeTrades(200);
    });
    expect(mockMarketHub.subscribeTrades).toHaveBeenCalledWith(200);

    await act(async () => {
      await result.current.subscribeDepth(300);
    });
    expect(mockMarketHub.subscribeDepth).toHaveBeenCalledWith(300);
  });

  it('returns unsubscribe helpers that call hub methods', async () => {
    mockMarketHub.state = HubConnectionState.Connected;

    const { result } = renderHook(() => useMarketHub(), { wrapper });

    await act(async () => {
      await result.current.unsubscribeQuotes(100);
    });
    expect(mockMarketHub.unsubscribeQuotes).toHaveBeenCalledWith(100);

    await act(async () => {
      await result.current.unsubscribeTrades(200);
    });
    expect(mockMarketHub.unsubscribeTrades).toHaveBeenCalledWith(200);

    await act(async () => {
      await result.current.unsubscribeDepth(300);
    });
    expect(mockMarketHub.unsubscribeDepth).toHaveBeenCalledWith(300);
  });

  it('reports hub connection state', () => {
    mockMarketHub.state = HubConnectionState.Connected;

    const { result } = renderHook(() => useMarketHub(), { wrapper });

    expect(result.current.state).toBe(HubConnectionState.Connected);
  });

  it('exposes the hub instance', () => {
    mockMarketHub.state = HubConnectionState.Connected;

    const { result } = renderHook(() => useMarketHub(), { wrapper });

    expect(result.current.hub).toBe(mockMarketHub);
  });
});
