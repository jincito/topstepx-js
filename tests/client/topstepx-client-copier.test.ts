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

let onTradeCallback: ((trade: any) => void) | null = null;
const mockTradeUnsub = vi.fn();

vi.mock('../../src/hubs/user-hub.js', () => ({
  UserHub: class MockUserHub {
    start = vi.fn().mockResolvedValue(undefined);
    stop = vi.fn().mockResolvedValue(undefined);
    onAccount = vi.fn().mockReturnValue(vi.fn());
    onOrder = vi.fn().mockReturnValue(vi.fn());
    onPosition = vi.fn().mockReturnValue(vi.fn());
    onTrade = vi.fn().mockImplementation((cb: (trade: any) => void) => {
      onTradeCallback = cb;
      return mockTradeUnsub;
    });
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
import { OrderType, OrderSide, PositionType } from '../../src/types/enums.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

type MockFn = ReturnType<typeof vi.fn>;

const config = {
  credentials: { userName: 'test', apiKey: 'key-123' },
};

/** Flush microtask queue to allow async callbacks to execute */
const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// ── copyTrade tests ─────────────────────────────────────────────────────────

describe('TopstepXClient copyTrade', () => {
  let client: TopstepXClient;

  beforeEach(() => {
    vi.clearAllMocks();
    onTradeCallback = null;
    client = new TopstepXClient(config);
    (client.orders.place as MockFn).mockResolvedValue(200);
  });

  it('places market orders on all target accounts', async () => {
    await client.copyTrade(
      100,
      [201, 202],
      { contractId: 'CON.ES', side: OrderSide.Bid, size: 2 },
    );

    const calls = (client.orders.place as MockFn).mock.calls;
    expect(calls).toHaveLength(2);

    expect(calls[0][0]).toMatchObject({
      accountId: 201,
      contractId: 'CON.ES',
      type: OrderType.Market,
      side: OrderSide.Bid,
      size: 2,
    });

    expect(calls[1][0]).toMatchObject({
      accountId: 202,
      contractId: 'CON.ES',
      type: OrderType.Market,
      side: OrderSide.Bid,
      size: 2,
    });
  });

  it('applies size ratio', async () => {
    await client.copyTrade(
      100,
      [201],
      { contractId: 'CON.ES', side: OrderSide.Bid, size: 4 },
      { sizeRatio: 0.5 },
    );

    const calls = (client.orders.place as MockFn).mock.calls;
    expect(calls[0][0].size).toBe(2); // 4 * 0.5 = 2
  });

  it('clamps to maxSize', async () => {
    await client.copyTrade(
      100,
      [201],
      { contractId: 'CON.ES', side: OrderSide.Bid, size: 2 },
      { sizeRatio: 2.0, maxSize: 3 },
    );

    const calls = (client.orders.place as MockFn).mock.calls;
    expect(calls[0][0].size).toBe(3); // 2 * 2.0 = 4, clamped to 3
  });

  it('ensures minimum size of 1', async () => {
    await client.copyTrade(
      100,
      [201],
      { contractId: 'CON.ES', side: OrderSide.Bid, size: 1 },
      { sizeRatio: 0.1 },
    );

    const calls = (client.orders.place as MockFn).mock.calls;
    expect(calls[0][0].size).toBe(1); // 1 * 0.1 = 0.1, rounds to 0, clamped to 1
  });

  it('tags copied orders with source account ID', async () => {
    await client.copyTrade(
      100,
      [201],
      { contractId: 'CON.ES', side: OrderSide.Bid, size: 1 },
    );

    const calls = (client.orders.place as MockFn).mock.calls;
    expect(calls[0][0].customTag).toBe('copy-100');
  });

  it('uses custom tag prefix', async () => {
    await client.copyTrade(
      100,
      [201],
      { contractId: 'CON.ES', side: OrderSide.Bid, size: 1 },
      { tagPrefix: 'mirror' },
    );

    const calls = (client.orders.place as MockFn).mock.calls;
    expect(calls[0][0].customTag).toBe('mirror-100');
  });
});

// ── mirrorPositions tests ───────────────────────────────────────────────────

describe('TopstepXClient mirrorPositions', () => {
  let client: TopstepXClient;

  beforeEach(() => {
    vi.clearAllMocks();
    onTradeCallback = null;
    client = new TopstepXClient(config);
    (client.orders.place as MockFn).mockResolvedValue(200);
    (client.orders.searchOpen as MockFn).mockResolvedValue([]);
    (client.positions.searchOpen as MockFn).mockResolvedValue([]);
  });

  it('performs initial position reconciliation', async () => {
    // Source has a Long position on ESZ5
    (client.positions.searchOpen as MockFn)
      .mockResolvedValueOnce([
        {
          id: 1,
          accountId: 100,
          contractId: 'CON.ES',
          creationTimestamp: '2025-01-01T00:00:00Z',
          type: PositionType.Long,
          size: 2,
          averagePrice: 5000,
        },
      ])
      // Target has no positions
      .mockResolvedValueOnce([]);

    await client.mirrorPositions(100, [201]);

    const placeCalls = (client.orders.place as MockFn).mock.calls;
    expect(placeCalls).toHaveLength(1);
    expect(placeCalls[0][0]).toMatchObject({
      accountId: 201,
      contractId: 'CON.ES',
      type: OrderType.Market,
      side: OrderSide.Bid, // Long -> Bid
      size: 2,
      customTag: 'copy-100',
    });
  });

  it('skips initial reconciliation when ignoreExistingPositions is true', async () => {
    await client.mirrorPositions(100, [201], { ignoreExistingPositions: true });

    expect(client.positions.searchOpen).not.toHaveBeenCalled();
  });

  it('subscribes to source trade events and replicates', async () => {
    await client.mirrorPositions(100, [201, 202]);

    expect(onTradeCallback).not.toBeNull();

    // Simulate a trade event on source account
    onTradeCallback!({
      id: 50,
      accountId: 100,
      contractId: 'CON.ES',
      creationTimestamp: '2025-01-01T00:00:00Z',
      price: 5000,
      profitAndLoss: null,
      fees: 2.5,
      side: OrderSide.Bid,
      size: 1,
      voided: false,
      orderId: 300,
    });

    await flushMicrotasks();

    // orders.place called for reconciliation (0 times since no positions) + 2 for targets
    const placeCalls = (client.orders.place as MockFn).mock.calls;
    expect(placeCalls).toHaveLength(2);
    expect(placeCalls[0][0]).toMatchObject({
      accountId: 201,
      contractId: 'CON.ES',
      type: OrderType.Market,
      side: OrderSide.Bid,
      size: 1,
    });
    expect(placeCalls[1][0]).toMatchObject({
      accountId: 202,
      contractId: 'CON.ES',
      type: OrderType.Market,
      side: OrderSide.Bid,
      size: 1,
    });
  });

  it('filters out copied order events to prevent loops', async () => {
    // Mock searchOpen to return an order with copy tag matching the trade's orderId
    (client.orders.searchOpen as MockFn).mockResolvedValue([
      {
        id: 300,
        accountId: 100,
        contractId: 'CON.ES',
        symbolId: 'ES',
        creationTimestamp: '2025-01-01T00:00:00Z',
        updateTimestamp: '2025-01-01T00:00:01Z',
        status: 1,
        type: OrderType.Market,
        side: OrderSide.Bid,
        size: 1,
        limitPrice: null,
        stopPrice: null,
        fillVolume: 1,
        filledPrice: 5000,
        customTag: 'copy-100', // matches tag prefix
      },
    ]);

    await client.mirrorPositions(100, [201]);

    // Reset place mock after reconciliation
    (client.orders.place as MockFn).mockClear();

    // Simulate a trade event triggered by the copied order
    onTradeCallback!({
      id: 50,
      accountId: 100,
      contractId: 'CON.ES',
      creationTimestamp: '2025-01-01T00:00:00Z',
      price: 5000,
      profitAndLoss: null,
      fees: 2.5,
      side: OrderSide.Bid,
      size: 1,
      voided: false,
      orderId: 300, // matches the copy-tagged order
    });

    await flushMicrotasks();

    // Should NOT place any orders (loop prevented)
    expect(client.orders.place).not.toHaveBeenCalled();
  });

  it('ignores trades from other accounts', async () => {
    await client.mirrorPositions(100, [201]);

    // Simulate a trade event from a different account
    onTradeCallback!({
      id: 50,
      accountId: 999, // not the source account
      contractId: 'CON.ES',
      creationTimestamp: '2025-01-01T00:00:00Z',
      price: 5000,
      profitAndLoss: null,
      fees: 2.5,
      side: OrderSide.Bid,
      size: 1,
      voided: false,
      orderId: 300,
    });

    await flushMicrotasks();

    // Should NOT place any orders on targets
    expect(client.orders.place).not.toHaveBeenCalled();
  });

  it('stop() terminates mirroring and sets active to false', async () => {
    const controller = await client.mirrorPositions(100, [201]);

    expect(controller.active).toBe(true);

    await controller.stop();

    expect(controller.active).toBe(false);
    expect(mockTradeUnsub).toHaveBeenCalled();

    // Simulate a trade event after stop
    onTradeCallback!({
      id: 50,
      accountId: 100,
      contractId: 'CON.ES',
      creationTimestamp: '2025-01-01T00:00:00Z',
      price: 5000,
      profitAndLoss: null,
      fees: 2.5,
      side: OrderSide.Bid,
      size: 1,
      voided: false,
      orderId: 300,
    });

    await flushMicrotasks();

    // Should NOT place any orders (mirroring stopped)
    expect(client.orders.place).not.toHaveBeenCalled();
  });

  it('applies size ratio to mirrored trades', async () => {
    await client.mirrorPositions(100, [201], { sizeRatio: 2.0 });

    // Simulate a trade event
    onTradeCallback!({
      id: 50,
      accountId: 100,
      contractId: 'CON.ES',
      creationTimestamp: '2025-01-01T00:00:00Z',
      price: 5000,
      profitAndLoss: null,
      fees: 2.5,
      side: OrderSide.Bid,
      size: 3,
      voided: false,
      orderId: 300,
    });

    await flushMicrotasks();

    const placeCalls = (client.orders.place as MockFn).mock.calls;
    expect(placeCalls).toHaveLength(1);
    expect(placeCalls[0][0].size).toBe(6); // 3 * 2.0 = 6
  });

  it('reconciliation handles Short positions correctly', async () => {
    // Source has a Short position
    (client.positions.searchOpen as MockFn)
      .mockResolvedValueOnce([
        {
          id: 1,
          accountId: 100,
          contractId: 'CON.NQ',
          creationTimestamp: '2025-01-01T00:00:00Z',
          type: PositionType.Short,
          size: 3,
          averagePrice: 18000,
        },
      ])
      // Target has no positions
      .mockResolvedValueOnce([]);

    await client.mirrorPositions(100, [201]);

    const placeCalls = (client.orders.place as MockFn).mock.calls;
    expect(placeCalls).toHaveLength(1);
    expect(placeCalls[0][0]).toMatchObject({
      accountId: 201,
      contractId: 'CON.NQ',
      type: OrderType.Market,
      side: OrderSide.Ask, // Short -> Ask
      size: 3,
    });
  });
});
