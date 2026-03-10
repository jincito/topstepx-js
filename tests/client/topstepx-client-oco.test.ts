import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HubConnectionState } from '@microsoft/signalr';

// ── Mock all dependency modules using class-based mocks ─────────────────────
// vi.fn().mockImplementation with arrow functions cannot be called with `new`.
// Use real classes so constructors work correctly.

vi.mock('../../src/auth/auth-manager.js', () => ({
  AuthManager: class MockAuthManager {
    getToken = vi.fn().mockResolvedValue('mock-token');
  },
}));

vi.mock('../../src/http/http-client.js', () => ({
  HttpClient: class MockHttpClient {
    post = vi.fn();
  },
}));

vi.mock('../../src/api/account-service.js', () => ({
  AccountService: class MockAccountService {
    search = vi.fn();
  },
}));

vi.mock('../../src/api/contract-service.js', () => ({
  ContractService: class MockContractService {
    available = vi.fn();
    search = vi.fn();
    searchById = vi.fn();
  },
}));

vi.mock('../../src/api/order-service.js', () => ({
  OrderService: class MockOrderService {
    place = vi.fn();
    search = vi.fn();
    searchOpen = vi.fn();
    cancel = vi.fn();
    modify = vi.fn();
  },
}));

vi.mock('../../src/api/position-service.js', () => ({
  PositionService: class MockPositionService {
    searchOpen = vi.fn();
    closeContract = vi.fn();
    partialCloseContract = vi.fn();
  },
}));

vi.mock('../../src/api/trade-service.js', () => ({
  TradeService: class MockTradeService {
    search = vi.fn();
  },
}));

vi.mock('../../src/api/history-service.js', () => ({
  HistoryService: class MockHistoryService {
    retrieveBars = vi.fn();
  },
}));

let onOrderCallback: ((order: any) => void) | null = null;
const mockUnsubscribe = vi.fn();

vi.mock('../../src/hubs/user-hub.js', () => ({
  UserHub: class MockUserHub {
    start = vi.fn().mockResolvedValue(undefined);
    stop = vi.fn().mockResolvedValue(undefined);
    onAccount = vi.fn().mockReturnValue(vi.fn());
    onOrder = vi.fn().mockImplementation((cb: (order: any) => void) => {
      onOrderCallback = cb;
      return mockUnsubscribe;
    });
    onPosition = vi.fn().mockReturnValue(vi.fn());
    onTrade = vi.fn().mockReturnValue(vi.fn());
    subscribeAccounts = vi.fn().mockResolvedValue(undefined);
    unsubscribeAccounts = vi.fn().mockResolvedValue(undefined);
    subscribeOrders = vi.fn().mockResolvedValue(undefined);
    unsubscribeOrders = vi.fn().mockResolvedValue(undefined);
    subscribePositions = vi.fn().mockResolvedValue(undefined);
    unsubscribePositions = vi.fn().mockResolvedValue(undefined);
    subscribeTrades = vi.fn().mockResolvedValue(undefined);
    unsubscribeTrades = vi.fn().mockResolvedValue(undefined);
    state = HubConnectionState.Connected;
  },
}));

vi.mock('../../src/hubs/market-hub.js', () => ({
  MarketHub: class MockMarketHub {
    start = vi.fn().mockResolvedValue(undefined);
    stop = vi.fn().mockResolvedValue(undefined);
    onQuote = vi.fn().mockReturnValue(vi.fn());
    onTrade = vi.fn().mockReturnValue(vi.fn());
    onDepth = vi.fn().mockReturnValue(vi.fn());
    subscribeQuotes = vi.fn().mockResolvedValue(undefined);
    unsubscribeQuotes = vi.fn().mockResolvedValue(undefined);
    subscribeTrades = vi.fn().mockResolvedValue(undefined);
    unsubscribeTrades = vi.fn().mockResolvedValue(undefined);
    subscribeDepth = vi.fn().mockResolvedValue(undefined);
    unsubscribeDepth = vi.fn().mockResolvedValue(undefined);
    state = HubConnectionState.Connected;
  },
}));

// ── Import after mocks ─────────────────────────────────────────────────────

import { TopstepXClient } from '../../src/client/topstepx-client.js';
import { OrderStatus, OrderType, OrderSide } from '../../src/types/enums.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

type MockFn = ReturnType<typeof vi.fn>;

const config = {
  credentials: { userName: 'test', apiKey: 'key-123' },
};

const ocoOptions = {
  accountId: 42,
  contractId: 'CON.NQ',
  orderA: {
    side: OrderSide.Bid,
    type: OrderType.Limit,
    size: 1,
    limitPrice: 4500,
  },
  orderB: {
    side: OrderSide.Ask,
    type: OrderType.Limit,
    size: 1,
    limitPrice: 4600,
  },
};

describe('TopstepXClient placeOCO', () => {
  let client: TopstepXClient;

  beforeEach(() => {
    vi.clearAllMocks();
    onOrderCallback = null;
    client = new TopstepXClient(config);
    // Default: orders.place returns sequential IDs, orders.cancel resolves
    let placeCallCount = 0;
    (client.orders.place as MockFn).mockImplementation(async () => {
      placeCallCount++;
      return placeCallCount === 1 ? 100 : 200;
    });
    (client.orders.cancel as MockFn).mockResolvedValue(undefined);
  });

  it('places both orders with oco- group tags', async () => {
    const result = await client.placeOCO(ocoOptions);

    expect(result.orderIdA).toBe(100);
    expect(result.orderIdB).toBe(200);
    expect(client.orders.place).toHaveBeenCalledTimes(2);

    // Both calls should have customTag starting with 'oco-'
    const calls = (client.orders.place as MockFn).mock.calls;
    expect(calls[0][0].customTag).toMatch(/^oco-.*-a$/);
    expect(calls[1][0].customTag).toMatch(/^oco-.*-b$/);

    // Tags should share the same group prefix
    const tagA = calls[0][0].customTag as string;
    const tagB = calls[1][0].customTag as string;
    const groupA = tagA.replace(/-a$/, '');
    const groupB = tagB.replace(/-b$/, '');
    expect(groupA).toBe(groupB);
  });

  it('cancels order B when order A fills', async () => {
    const result = await client.placeOCO(ocoOptions);

    // Simulate order A filling
    onOrderCallback!({
      id: 100,
      accountId: 42,
      contractId: 'CON.NQ',
      status: OrderStatus.Filled,
      type: OrderType.Limit,
      side: OrderSide.Bid,
      size: 1,
      symbolId: 'NQ',
      creationTimestamp: '2025-01-01T00:00:00Z',
      updateTimestamp: '2025-01-01T00:00:01Z',
      limitPrice: 4500,
      stopPrice: null,
      fillVolume: 1,
      filledPrice: 4500,
      customTag: null,
    });

    // Allow microtask to process
    const fillResult = await result.result;

    expect(fillResult.filledOrderId).toBe(100);
    expect(fillResult.cancelledOrderId).toBe(200);
    expect(fillResult.bothFilled).toBe(false);
    expect(fillResult.filledOrder.id).toBe(100);
    expect(client.orders.cancel).toHaveBeenCalledWith({ accountId: 42, orderId: 200 });
  });

  it('cancels order A when order B fills', async () => {
    const result = await client.placeOCO(ocoOptions);

    // Simulate order B filling
    onOrderCallback!({
      id: 200,
      accountId: 42,
      contractId: 'CON.NQ',
      status: OrderStatus.Filled,
      type: OrderType.Limit,
      side: OrderSide.Ask,
      size: 1,
      symbolId: 'NQ',
      creationTimestamp: '2025-01-01T00:00:00Z',
      updateTimestamp: '2025-01-01T00:00:01Z',
      limitPrice: 4600,
      stopPrice: null,
      fillVolume: 1,
      filledPrice: 4600,
      customTag: null,
    });

    const fillResult = await result.result;

    expect(fillResult.filledOrderId).toBe(200);
    expect(fillResult.cancelledOrderId).toBe(100);
    expect(fillResult.bothFilled).toBe(false);
    expect(client.orders.cancel).toHaveBeenCalledWith({ accountId: 42, orderId: 100 });
  });

  it('sets bothFilled when cancel fails', async () => {
    // Make cancel throw to simulate both orders already filled
    (client.orders.cancel as MockFn).mockRejectedValue(new Error('Order already filled'));

    const result = await client.placeOCO(ocoOptions);

    // Simulate order A filling
    onOrderCallback!({
      id: 100,
      accountId: 42,
      contractId: 'CON.NQ',
      status: OrderStatus.Filled,
      type: OrderType.Limit,
      side: OrderSide.Bid,
      size: 1,
      symbolId: 'NQ',
      creationTimestamp: '2025-01-01T00:00:00Z',
      updateTimestamp: '2025-01-01T00:00:01Z',
      limitPrice: 4500,
      stopPrice: null,
      fillVolume: 1,
      filledPrice: 4500,
      customTag: null,
    });

    const fillResult = await result.result;

    expect(fillResult.bothFilled).toBe(true);
    expect(fillResult.filledOrderId).toBe(100);
    expect(fillResult.cancelledOrderId).toBe(200);
  });

  it('cancel() cancels both orders', async () => {
    const result = await client.placeOCO(ocoOptions);

    await result.cancel();

    expect(client.orders.cancel).toHaveBeenCalledTimes(2);
    expect(client.orders.cancel).toHaveBeenCalledWith({ accountId: 42, orderId: 100 });
    expect(client.orders.cancel).toHaveBeenCalledWith({ accountId: 42, orderId: 200 });
  });

  it('ignores non-matching order fills', async () => {
    await client.placeOCO(ocoOptions);

    // Simulate a fill for a completely different order
    onOrderCallback!({
      id: 999,
      accountId: 42,
      contractId: 'CON.NQ',
      status: OrderStatus.Filled,
      type: OrderType.Limit,
      side: OrderSide.Bid,
      size: 1,
      symbolId: 'NQ',
      creationTimestamp: '2025-01-01T00:00:00Z',
      updateTimestamp: '2025-01-01T00:00:01Z',
      limitPrice: 4500,
      stopPrice: null,
      fillVolume: 1,
      filledPrice: 4500,
      customTag: null,
    });

    // Cancel should NOT have been called (only place calls happened during setup)
    expect(client.orders.cancel).not.toHaveBeenCalled();
  });

  it('ignores non-Filled status updates', async () => {
    await client.placeOCO(ocoOptions);

    // Simulate an Open status for order A (not filled)
    onOrderCallback!({
      id: 100,
      accountId: 42,
      contractId: 'CON.NQ',
      status: OrderStatus.Open,
      type: OrderType.Limit,
      side: OrderSide.Bid,
      size: 1,
      symbolId: 'NQ',
      creationTimestamp: '2025-01-01T00:00:00Z',
      updateTimestamp: '2025-01-01T00:00:01Z',
      limitPrice: 4500,
      stopPrice: null,
      fillVolume: 0,
      filledPrice: null,
      customTag: null,
    });

    expect(client.orders.cancel).not.toHaveBeenCalled();
  });

  it('cancels order A if order B placement fails', async () => {
    let placeCallCount = 0;
    (client.orders.place as MockFn).mockImplementation(async () => {
      placeCallCount++;
      if (placeCallCount === 2) throw new Error('Placement failed');
      return 100;
    });

    await expect(client.placeOCO(ocoOptions)).rejects.toThrow('Placement failed');

    // Order A should be cancelled to avoid orphan
    expect(client.orders.cancel).toHaveBeenCalledWith({ accountId: 42, orderId: 100 });
  });

  describe('timeout', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('rejects result on timeout and cancels both orders', async () => {
      const result = await client.placeOCO({ ...ocoOptions, timeoutMs: 100 });

      // Attach rejection handler BEFORE advancing timers
      const rejection = expect(result.result).rejects.toThrow('OCO timed out after 100ms');

      // Advance past the timeout
      await vi.advanceTimersByTimeAsync(150);

      await rejection;

      // Both orders should be cancelled
      expect(client.orders.cancel).toHaveBeenCalledWith({ accountId: 42, orderId: 100 });
      expect(client.orders.cancel).toHaveBeenCalledWith({ accountId: 42, orderId: 200 });
    });
  });
});
