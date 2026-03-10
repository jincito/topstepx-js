import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { AuthManager } from '../../src/auth/auth-manager.js';
import { BaseHub } from '../../src/hubs/base-hub.js';

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
const mockWithAutomaticReconnect = vi.fn();
const mockConfigureLogging = vi.fn();
const mockBuild = vi.fn().mockReturnValue(mockConnection);

vi.mock('@microsoft/signalr', () => {
  // Use a real class so `new HubConnectionBuilder()` works
  class MockHubConnectionBuilder {
    withUrl(...args: unknown[]) {
      mockWithUrl(...args);
      return this;
    }
    withAutomaticReconnect(...args: unknown[]) {
      mockWithAutomaticReconnect(...args);
      return this;
    }
    configureLogging(...args: unknown[]) {
      mockConfigureLogging(...args);
      return this;
    }
    build() {
      return mockBuild();
    }
  }

  return {
    HubConnectionBuilder: MockHubConnectionBuilder,
    HubConnectionState: {
      Disconnected: 'Disconnected',
      Connected: 'Connected',
      Reconnecting: 'Reconnecting',
    },
    HttpTransportType: {
      WebSockets: 1,
    },
    LogLevel: {
      Warning: 3,
    },
  };
});

// ── Concrete subclass for testing abstract BaseHub ─────────────────
class TestHub extends BaseHub {
  async testSubscribe(method: string, ...args: unknown[]) {
    return this.subscribe(method, ...args);
  }
  async testUnsubscribe(method: string, ...args: unknown[]) {
    return this.unsubscribe(method, ...args);
  }
  testOn<T>(event: string, handler: (data: T) => void) {
    return this.on(event, handler);
  }
}

// ── Test suite ─────────────────────────────────────────────────────
describe('BaseHub', () => {
  let hub: TestHub;
  let mockAuthManager: AuthManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConnection.state = 'Disconnected';

    mockAuthManager = {
      getToken: vi.fn().mockResolvedValue('test-token'),
    } as unknown as AuthManager;

    hub = new TestHub({ url: 'https://rtc.topstepx.com/hubs/test', authManager: mockAuthManager });
  });

  it('constructor builds connection with correct options', () => {
    expect(mockWithUrl).toHaveBeenCalledWith(
      'https://rtc.topstepx.com/hubs/test',
      expect.objectContaining({
        skipNegotiation: true,
        transport: 1, // HttpTransportType.WebSockets
        accessTokenFactory: expect.any(Function),
      }),
    );
    expect(mockWithAutomaticReconnect).toHaveBeenCalledWith(
      expect.objectContaining({
        nextRetryDelayInMilliseconds: expect.any(Function),
      }),
    );
    expect(mockConfigureLogging).toHaveBeenCalledWith(3); // LogLevel.Warning
    expect(mockBuild).toHaveBeenCalled();
  });

  it('start() calls connection.start()', async () => {
    mockConnection.state = 'Disconnected';
    await hub.start();
    expect(mockConnection.start).toHaveBeenCalled();
  });

  it('stop() calls connection.stop() and clears subscriptions', async () => {
    // Capture onreconnected callback registered during construction
    const reconnectedCallback = mockConnection.onreconnected.mock.calls[0][0] as () => Promise<void>;

    // Subscribe to something first
    await hub.testSubscribe('SubscribeOrders', 123);
    vi.clearAllMocks();

    await hub.stop();
    expect(mockConnection.stop).toHaveBeenCalled();

    // Verify subscriptions were cleared: trigger onreconnected and check no replays
    vi.clearAllMocks();
    await reconnectedCallback();
    expect(mockConnection.invoke).not.toHaveBeenCalled();
  });

  it('state returns connection state', () => {
    mockConnection.state = 'Connected';
    expect(hub.state).toBe('Connected');
  });

  it('subscribe() invokes server method and tracks subscription', async () => {
    await hub.testSubscribe('SubscribeOrders', 123);
    expect(mockConnection.invoke).toHaveBeenCalledWith('SubscribeOrders', 123);
  });

  it('unsubscribe() invokes server method and removes from tracking', async () => {
    // Capture onreconnected callback before clearing mocks
    const reconnectedCallback = mockConnection.onreconnected.mock.calls[0][0] as () => Promise<void>;

    await hub.testSubscribe('SubscribeOrders', 123);
    vi.clearAllMocks();

    await hub.testUnsubscribe('UnsubscribeOrders', 123);
    expect(mockConnection.invoke).toHaveBeenCalledWith('UnsubscribeOrders', 123);

    // Trigger onreconnected and verify SubscribeOrders(123) is NOT replayed
    vi.clearAllMocks();
    await reconnectedCallback();
    expect(mockConnection.invoke).not.toHaveBeenCalled();
  });

  it('onreconnected replays all active subscriptions', async () => {
    // Capture onreconnected callback before clearing mocks
    const reconnectedCallback = mockConnection.onreconnected.mock.calls[0][0] as () => Promise<void>;

    await hub.testSubscribe('SubscribeOrders', 1);
    await hub.testSubscribe('SubscribePositions', 2);
    vi.clearAllMocks();

    // Call the onreconnected callback
    await reconnectedCallback();

    expect(mockConnection.invoke).toHaveBeenCalledWith('SubscribeOrders', 1);
    expect(mockConnection.invoke).toHaveBeenCalledWith('SubscribePositions', 2);
  });

  it('on() registers event handler and returns unsubscribe function', () => {
    const handler = vi.fn();
    const unsub = hub.testOn('SomeEvent', handler);

    expect(mockConnection.on).toHaveBeenCalledWith('SomeEvent', handler);

    unsub();
    expect(mockConnection.off).toHaveBeenCalledWith('SomeEvent', handler);
  });

  it('accessTokenFactory calls authManager.getToken()', async () => {
    const withUrlCall = mockWithUrl.mock.calls[0];
    const options = withUrlCall[1] as { accessTokenFactory: () => Promise<string> };
    const token = await options.accessTokenFactory();
    expect(token).toBe('test-token');
    expect((mockAuthManager.getToken as Mock)).toHaveBeenCalled();
  });
});
