import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthManager } from '../../src/auth/auth-manager.js';
import { MarketHub } from '../../src/hubs/market-hub.js';

// ── Mock p-retry to execute immediately (no actual retries) ────────
vi.mock('p-retry', () => ({
  default: async (fn: () => Promise<void>) => fn(),
}));

// ── Mock @microsoft/signalr ────────────────────────────────────────
const mockConnection = {
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  invoke: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  off: vi.fn(),
  onreconnected: vi.fn(),
  onreconnecting: vi.fn(),
  onclose: vi.fn(),
  state: 'Disconnected' as string,
};

const mockWithUrl = vi.fn();

vi.mock('@microsoft/signalr', () => {
  class MockHubConnectionBuilder {
    withUrl(...args: unknown[]) {
      mockWithUrl(...args);
      return this;
    }
    withAutomaticReconnect() {
      return this;
    }
    configureLogging() {
      return this;
    }
    build() {
      return mockConnection;
    }
  }

  return {
    HubConnectionBuilder: MockHubConnectionBuilder,
    HubConnectionState: {
      Disconnected: 'Disconnected',
      Connected: 'Connected',
      Reconnecting: 'Reconnecting',
    },
    HttpTransportType: { WebSockets: 1 },
    LogLevel: { Warning: 3 },
  };
});

// ── Test suite ─────────────────────────────────────────────────────
describe('MarketHub', () => {
  let hub: MarketHub;
  let mockAuthManager: AuthManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConnection.state = 'Disconnected';

    mockAuthManager = {
      getToken: vi.fn().mockResolvedValue('test-token'),
    } as unknown as AuthManager;

    hub = new MarketHub({ authManager: mockAuthManager });
  });

  it('constructor defaults to Market Hub URL', () => {
    expect(mockWithUrl).toHaveBeenCalledWith(
      'https://rtc.topstepx.com/hubs/market',
      expect.any(Object),
    );
  });

  describe('event handlers', () => {
    it('onQuote registers GatewayQuote handler', () => {
      const handler = vi.fn();
      hub.onQuote(handler);
      expect(mockConnection.on).toHaveBeenCalledWith('GatewayQuote', handler);
    });

    it('onTrade registers GatewayTrade handler', () => {
      const handler = vi.fn();
      hub.onTrade(handler);
      expect(mockConnection.on).toHaveBeenCalledWith('GatewayTrade', handler);
    });

    it('onDepth registers GatewayDepth handler', () => {
      const handler = vi.fn();
      hub.onDepth(handler);
      expect(mockConnection.on).toHaveBeenCalledWith('GatewayDepth', handler);
    });
  });

  describe('subscribe/unsubscribe', () => {
    it('subscribeQuotes invokes SubscribeContractQuotes with contractId', async () => {
      await hub.subscribeQuotes(100);
      expect(mockConnection.invoke).toHaveBeenCalledWith('SubscribeContractQuotes', 100);
    });

    it('unsubscribeQuotes invokes UnsubscribeContractQuotes with contractId', async () => {
      await hub.unsubscribeQuotes(100);
      expect(mockConnection.invoke).toHaveBeenCalledWith('UnsubscribeContractQuotes', 100);
    });

    it('subscribeTrades invokes SubscribeContractTrades with contractId', async () => {
      await hub.subscribeTrades(200);
      expect(mockConnection.invoke).toHaveBeenCalledWith('SubscribeContractTrades', 200);
    });

    it('unsubscribeTrades invokes UnsubscribeContractTrades with contractId', async () => {
      await hub.unsubscribeTrades(200);
      expect(mockConnection.invoke).toHaveBeenCalledWith('UnsubscribeContractTrades', 200);
    });

    it('subscribeDepth invokes SubscribeContractMarketDepth with contractId', async () => {
      await hub.subscribeDepth(300);
      expect(mockConnection.invoke).toHaveBeenCalledWith('SubscribeContractMarketDepth', 300);
    });

    it('unsubscribeDepth invokes UnsubscribeContractMarketDepth with contractId', async () => {
      await hub.unsubscribeDepth(300);
      expect(mockConnection.invoke).toHaveBeenCalledWith('UnsubscribeContractMarketDepth', 300);
    });
  });

  it('event handler unsubscribe works', () => {
    const handler = vi.fn();
    const unsub = hub.onQuote(handler);
    expect(mockConnection.on).toHaveBeenCalledWith('GatewayQuote', handler);

    unsub();
    expect(mockConnection.off).toHaveBeenCalledWith('GatewayQuote', handler);
  });
});
