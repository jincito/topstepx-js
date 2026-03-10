import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthManager } from '../../src/auth/auth-manager.js';
import { UserHub } from '../../src/hubs/user-hub.js';

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
describe('UserHub', () => {
  let hub: UserHub;
  let mockAuthManager: AuthManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConnection.state = 'Disconnected';

    mockAuthManager = {
      getToken: vi.fn().mockResolvedValue('test-token'),
    } as unknown as AuthManager;

    hub = new UserHub({ authManager: mockAuthManager });
  });

  it('constructor defaults to User Hub URL', () => {
    expect(mockWithUrl).toHaveBeenCalledWith(
      'https://rtc.topstepx.com/hubs/user',
      expect.any(Object),
    );
  });

  it('constructor accepts custom URL', () => {
    vi.clearAllMocks();
    new UserHub({ authManager: mockAuthManager, url: 'https://custom.com/hubs/user' });
    expect(mockWithUrl).toHaveBeenCalledWith(
      'https://custom.com/hubs/user',
      expect.any(Object),
    );
  });

  describe('event handlers', () => {
    it('onAccount registers GatewayUserAccount handler', () => {
      const handler = vi.fn();
      hub.onAccount(handler);
      expect(mockConnection.on).toHaveBeenCalledWith('GatewayUserAccount', handler);
    });

    it('onOrder registers GatewayUserOrder handler', () => {
      const handler = vi.fn();
      hub.onOrder(handler);
      expect(mockConnection.on).toHaveBeenCalledWith('GatewayUserOrder', handler);
    });

    it('onPosition registers GatewayUserPosition handler', () => {
      const handler = vi.fn();
      hub.onPosition(handler);
      expect(mockConnection.on).toHaveBeenCalledWith('GatewayUserPosition', handler);
    });

    it('onTrade registers GatewayUserTrade handler', () => {
      const handler = vi.fn();
      hub.onTrade(handler);
      expect(mockConnection.on).toHaveBeenCalledWith('GatewayUserTrade', handler);
    });
  });

  describe('subscribe/unsubscribe', () => {
    it('subscribeAccounts invokes SubscribeAccounts', async () => {
      await hub.subscribeAccounts();
      expect(mockConnection.invoke).toHaveBeenCalledWith('SubscribeAccounts');
    });

    it('unsubscribeAccounts invokes UnsubscribeAccounts', async () => {
      await hub.unsubscribeAccounts();
      expect(mockConnection.invoke).toHaveBeenCalledWith('UnsubscribeAccounts');
    });

    it('subscribeOrders invokes SubscribeOrders with accountId', async () => {
      await hub.subscribeOrders(123);
      expect(mockConnection.invoke).toHaveBeenCalledWith('SubscribeOrders', 123);
    });

    it('unsubscribeOrders invokes UnsubscribeOrders with accountId', async () => {
      await hub.unsubscribeOrders(123);
      expect(mockConnection.invoke).toHaveBeenCalledWith('UnsubscribeOrders', 123);
    });

    it('subscribePositions invokes SubscribePositions with accountId', async () => {
      await hub.subscribePositions(456);
      expect(mockConnection.invoke).toHaveBeenCalledWith('SubscribePositions', 456);
    });

    it('unsubscribePositions invokes UnsubscribePositions with accountId', async () => {
      await hub.unsubscribePositions(456);
      expect(mockConnection.invoke).toHaveBeenCalledWith('UnsubscribePositions', 456);
    });

    it('subscribeTrades invokes SubscribeTrades with accountId', async () => {
      await hub.subscribeTrades(789);
      expect(mockConnection.invoke).toHaveBeenCalledWith('SubscribeTrades', 789);
    });

    it('unsubscribeTrades invokes UnsubscribeTrades with accountId', async () => {
      await hub.unsubscribeTrades(789);
      expect(mockConnection.invoke).toHaveBeenCalledWith('UnsubscribeTrades', 789);
    });
  });

  it('event handler unsubscribe works', () => {
    const handler = vi.fn();
    const unsub = hub.onOrder(handler);
    expect(mockConnection.on).toHaveBeenCalledWith('GatewayUserOrder', handler);

    unsub();
    expect(mockConnection.off).toHaveBeenCalledWith('GatewayUserOrder', handler);
  });
});
