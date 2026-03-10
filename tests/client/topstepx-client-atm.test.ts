import { describe, it, expect, vi, beforeEach } from 'vitest';
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
let onPositionCallback: ((position: any) => void) | null = null;
const mockOrderUnsub = vi.fn();
const mockPositionUnsub = vi.fn();

vi.mock('../../src/hubs/user-hub.js', () => ({
  UserHub: class MockUserHub {
    start = vi.fn().mockResolvedValue(undefined);
    stop = vi.fn().mockResolvedValue(undefined);
    onAccount = vi.fn().mockReturnValue(vi.fn());
    onOrder = vi.fn().mockImplementation((cb: (order: any) => void) => {
      onOrderCallback = cb;
      return mockOrderUnsub;
    });
    onPosition = vi.fn().mockImplementation((cb: (position: any) => void) => {
      onPositionCallback = cb;
      return mockPositionUnsub;
    });
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
import type { ATMStrategyTemplate } from '../../src/types/client.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

type MockFn = ReturnType<typeof vi.fn>;

const config = {
  credentials: { userName: 'test', apiKey: 'key-123' },
};

const mockContract = {
  id: 'CON.NQ',
  name: 'NQ',
  description: 'E-mini NASDAQ',
  tickSize: 0.25,
  tickValue: 5.0,
  activeContract: true,
  symbolId: 'NQ',
};

const makeFillOrder = (overrides: Record<string, any> = {}) => ({
  id: 100,
  accountId: 42,
  contractId: 'CON.NQ',
  symbolId: 'NQ',
  creationTimestamp: '2025-01-01T00:00:00Z',
  updateTimestamp: '2025-01-01T00:00:01Z',
  status: OrderStatus.Filled,
  type: OrderType.Limit,
  side: OrderSide.Bid,
  size: 2,
  limitPrice: 5000,
  stopPrice: null,
  fillVolume: 2,
  filledPrice: 5000,
  customTag: null,
  ...overrides,
});

const makeTemplate = (overrides: Partial<ATMStrategyTemplate> = {}): ATMStrategyTemplate => ({
  name: 'scalp',
  targets: [
    { ticks: 20, size: 1 },
    { ticks: 40, size: 1 },
  ],
  stopLoss: { ticks: 10 },
  ...overrides,
});

/** Flush microtask queue to allow .then() chains to execute */
const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// ── executeATMStrategy tests ────────────────────────────────────────────────

describe('TopstepXClient executeATMStrategy', () => {
  let client: TopstepXClient;

  beforeEach(() => {
    vi.clearAllMocks();
    onOrderCallback = null;
    onPositionCallback = null;
    client = new TopstepXClient(config);
    let placeCallCount = 0;
    (client.orders.place as MockFn).mockImplementation(async () => {
      placeCallCount++;
      return 100 + placeCallCount - 1; // 100, 101, 102, ...
    });
    (client.orders.cancel as MockFn).mockResolvedValue(undefined);
    (client.orders.modify as MockFn).mockResolvedValue(undefined);
    (client.orders.searchOpen as MockFn).mockResolvedValue([]);
    (client.contracts.searchById as MockFn).mockResolvedValue([mockContract]);
  });

  it('throws if template has no targets', async () => {
    const template = makeTemplate({ targets: [] });

    await expect(
      client.executeATMStrategy(42, 'CON.NQ', OrderSide.Bid, OrderType.Limit, 5000, undefined, template),
    ).rejects.toThrow('ATM strategy must have at least one target');
  });

  it('calls placeMultiTargetBracket with correct options', async () => {
    const template = makeTemplate();

    await client.executeATMStrategy(42, 'CON.NQ', OrderSide.Bid, OrderType.Limit, 5000, undefined, template);

    const calls = (client.orders.place as MockFn).mock.calls;
    // placeMultiTargetBracket places the entry order
    expect(calls[0][0]).toMatchObject({
      accountId: 42,
      contractId: 'CON.NQ',
      type: OrderType.Limit,
      side: OrderSide.Bid,
      size: 2, // sum of targets: 1 + 1
      limitPrice: 5000,
      stopLossBracket: { ticks: 10, type: OrderType.Stop },
      customTag: 'atm-scalp',
    });
  });

  it('uses TrailingStop type when trailPrice is set in template', async () => {
    const template = makeTemplate({
      stopLoss: { ticks: 10, trailPrice: 5 },
    });

    await client.executeATMStrategy(42, 'CON.NQ', OrderSide.Bid, OrderType.Limit, 5000, undefined, template);

    const calls = (client.orders.place as MockFn).mock.calls;
    expect(calls[0][0].stopLossBracket).toMatchObject({
      ticks: 10,
      type: OrderType.TrailingStop,
    });
  });

  it('uses explicit stop loss type from template', async () => {
    const template = makeTemplate({
      stopLoss: { ticks: 10, type: OrderType.TrailingStop },
    });

    await client.executeATMStrategy(42, 'CON.NQ', OrderSide.Bid, OrderType.Limit, 5000, undefined, template);

    const calls = (client.orders.place as MockFn).mock.calls;
    expect(calls[0][0].stopLossBracket).toMatchObject({
      ticks: 10,
      type: OrderType.TrailingStop,
    });
  });

  it('returns ATMResult with cancel function', async () => {
    const template = makeTemplate();

    const result = await client.executeATMStrategy(42, 'CON.NQ', OrderSide.Bid, OrderType.Limit, 5000, undefined, template);

    expect(result.entryOrderId).toBe(100);
    expect(result.targetOrderIds).toBeDefined();
    expect(typeof result.cancel).toBe('function');
    expect(result.result).toBeInstanceOf(Promise);

    // cancel() should cancel orders
    await result.cancel();
    expect(client.orders.cancel).toHaveBeenCalledWith({ accountId: 42, orderId: 100 });
  });

  it('auto-calculates entrySize from sum of target sizes', async () => {
    const template = makeTemplate({
      targets: [
        { ticks: 10, size: 2 },
        { ticks: 20, size: 1 },
        { ticks: 30, size: 1 },
      ],
    });

    await client.executeATMStrategy(42, 'CON.NQ', OrderSide.Bid, OrderType.Limit, 5000, undefined, template);

    const calls = (client.orders.place as MockFn).mock.calls;
    // entrySize should be 2 + 1 + 1 = 4
    expect(calls[0][0].size).toBe(4);
  });

  it('tags orders with atm-{template.name}', async () => {
    const template = makeTemplate({ name: 'scalp' });

    await client.executeATMStrategy(42, 'CON.NQ', OrderSide.Bid, OrderType.Limit, 5000, undefined, template);

    const calls = (client.orders.place as MockFn).mock.calls;
    expect(calls[0][0].customTag).toBe('atm-scalp');
  });

  it('breakeven modifies SL order when trigger is reached', async () => {
    const template = makeTemplate({
      targets: [{ ticks: 40, size: 1 }],
      stopLoss: { ticks: 10 },
      breakeven: { triggerTicks: 20, offsetTicks: 2 },
    });

    // Mock searchOpen to return a SL order for breakeven modification
    const mockSlOrder = {
      id: 300,
      accountId: 42,
      contractId: 'CON.NQ',
      symbolId: 'NQ',
      creationTimestamp: '2025-01-01T00:00:00Z',
      updateTimestamp: '2025-01-01T00:00:01Z',
      status: OrderStatus.Open,
      type: OrderType.Stop,
      side: OrderSide.Ask, // closing side for a buy
      size: 1,
      limitPrice: null,
      stopPrice: 4997.5,
      fillVolume: 0,
      filledPrice: null,
      customTag: null,
    };
    (client.orders.searchOpen as MockFn).mockResolvedValue([mockSlOrder]);

    const result = await client.executeATMStrategy(42, 'CON.NQ', OrderSide.Bid, OrderType.Limit, 5000, undefined, template);

    // 1. Simulate entry fill
    onOrderCallback!(makeFillOrder({ id: 100, filledPrice: 5000, size: 1, fillVolume: 1 }));

    // Wait for the .then() chain to set up position monitoring
    await result.result;
    await flushMicrotasks();

    // 2. Simulate position update with profit >= 20 ticks
    // For buy: profitTicks = (averagePrice - entryPrice) / tickSize
    // Need >= 20 ticks at tickSize 0.25: 20 * 0.25 = 5.0, so averagePrice >= 5005
    onPositionCallback!({
      id: 1,
      accountId: 42,
      contractId: 'CON.NQ',
      creationTimestamp: '2025-01-01T00:00:00Z',
      type: 1, // Long
      size: 1,
      averagePrice: 5005, // 20 ticks profit
    });

    // Wait for the async modify chain
    await flushMicrotasks();

    // breakeven price = 5000 + 2 * 0.25 = 5000.5
    expect(client.orders.modify).toHaveBeenCalledWith({
      accountId: 42,
      orderId: 300,
      stopPrice: 5000.5,
    });
  });

  it('breakeven unsubscribes after triggering', async () => {
    const template = makeTemplate({
      targets: [{ ticks: 40, size: 1 }],
      stopLoss: { ticks: 10 },
      breakeven: { triggerTicks: 20, offsetTicks: 2 },
    });

    const mockSlOrder = {
      id: 300,
      accountId: 42,
      contractId: 'CON.NQ',
      symbolId: 'NQ',
      creationTimestamp: '2025-01-01T00:00:00Z',
      updateTimestamp: '2025-01-01T00:00:01Z',
      status: OrderStatus.Open,
      type: OrderType.Stop,
      side: OrderSide.Ask,
      size: 1,
      limitPrice: null,
      stopPrice: 4997.5,
      fillVolume: 0,
      filledPrice: null,
      customTag: null,
    };
    (client.orders.searchOpen as MockFn).mockResolvedValue([mockSlOrder]);

    const result = await client.executeATMStrategy(42, 'CON.NQ', OrderSide.Bid, OrderType.Limit, 5000, undefined, template);

    // Simulate entry fill
    onOrderCallback!(makeFillOrder({ id: 100, filledPrice: 5000, size: 1, fillVolume: 1 }));

    await result.result;
    await flushMicrotasks();

    // Trigger breakeven
    onPositionCallback!({
      id: 1,
      accountId: 42,
      contractId: 'CON.NQ',
      creationTimestamp: '2025-01-01T00:00:00Z',
      type: 1,
      size: 1,
      averagePrice: 5005,
    });

    await flushMicrotasks();

    // Clear mock calls to check no further calls
    (client.orders.modify as MockFn).mockClear();
    (client.orders.searchOpen as MockFn).mockClear();

    // Send another position update -- should NOT trigger another modify
    onPositionCallback!({
      id: 1,
      accountId: 42,
      contractId: 'CON.NQ',
      creationTimestamp: '2025-01-01T00:00:00Z',
      type: 1,
      size: 1,
      averagePrice: 5010,
    });

    await flushMicrotasks();

    // The unsubscribe was called, so onPosition callback should be detached.
    // Since mockPositionUnsub was called internally, the second position update
    // should not reach the breakeven logic. However, since our mock doesn't
    // actually unsubscribe, we verify via the unsub mock being called.
    expect(mockPositionUnsub).toHaveBeenCalled();
    // No additional searchOpen or modify calls should happen after unsub
    expect(client.orders.searchOpen).not.toHaveBeenCalled();
  });
});
