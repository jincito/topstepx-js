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
import { OrderStatus, OrderType, OrderSide, PositionType } from '../../src/types/enums.js';

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
  size: 3,
  limitPrice: 5000,
  stopPrice: null,
  fillVolume: 3,
  filledPrice: 5000,
  customTag: null,
  ...overrides,
});

// ── placeMultiTargetBracket tests ───────────────────────────────────────────

describe('TopstepXClient placeMultiTargetBracket', () => {
  let client: TopstepXClient;

  beforeEach(() => {
    vi.clearAllMocks();
    onOrderCallback = null;
    client = new TopstepXClient(config);
    let placeCallCount = 0;
    (client.orders.place as MockFn).mockImplementation(async () => {
      placeCallCount++;
      return 100 + placeCallCount - 1; // 100, 101, 102, ...
    });
    (client.orders.cancel as MockFn).mockResolvedValue(undefined);
    (client.contracts.searchById as MockFn).mockResolvedValue([mockContract]);
  });

  it('throws if target sizes do not equal entry size', async () => {
    await expect(
      client.placeMultiTargetBracket({
        accountId: 42,
        contractId: 'CON.NQ',
        side: OrderSide.Bid,
        entryType: OrderType.Limit,
        entrySize: 3,
        limitPrice: 5000,
        targets: [
          { ticks: 20, size: 2 },
          { ticks: 40, size: 3 },
        ],
        stopLossTicks: 10,
      }),
    ).rejects.toThrow('Target sizes sum (5) must equal entry size (3)');
  });

  it('throws if no targets provided', async () => {
    await expect(
      client.placeMultiTargetBracket({
        accountId: 42,
        contractId: 'CON.NQ',
        side: OrderSide.Bid,
        entryType: OrderType.Limit,
        entrySize: 3,
        limitPrice: 5000,
        targets: [],
        stopLossTicks: 10,
      }),
    ).rejects.toThrow('At least one target is required');
  });

  it('places entry order with first target as native bracket', async () => {
    await client.placeMultiTargetBracket({
      accountId: 42,
      contractId: 'CON.NQ',
      side: OrderSide.Bid,
      entryType: OrderType.Limit,
      entrySize: 2,
      limitPrice: 5000,
      targets: [
        { ticks: 20, size: 1 },
        { ticks: 40, size: 1 },
      ],
      stopLossTicks: 10,
    });

    const calls = (client.orders.place as MockFn).mock.calls;
    expect(calls[0][0]).toMatchObject({
      accountId: 42,
      contractId: 'CON.NQ',
      type: OrderType.Limit,
      side: OrderSide.Bid,
      size: 2,
      limitPrice: 5000,
      takeProfitBracket: { ticks: 20, type: OrderType.Limit },
      stopLossBracket: { ticks: 10, type: OrderType.Stop },
    });
  });

  it('places additional TP orders after entry fills', async () => {
    const result = await client.placeMultiTargetBracket({
      accountId: 42,
      contractId: 'CON.NQ',
      side: OrderSide.Bid,
      entryType: OrderType.Limit,
      entrySize: 3,
      limitPrice: 5000,
      targets: [
        { ticks: 20, size: 1 },
        { ticks: 40, size: 1 },
        { ticks: 60, size: 1 },
      ],
      stopLossTicks: 10,
      customTag: 'my-bracket',
    });

    // Simulate entry fill
    onOrderCallback!(makeFillOrder({ id: 100, filledPrice: 5000 }));

    await result.result;

    // Entry + 2 additional TPs = 3 total place calls
    expect(client.orders.place).toHaveBeenCalledTimes(3);

    const calls = (client.orders.place as MockFn).mock.calls;

    // Second TP: 5000 + 40*0.25 = 5010
    expect(calls[1][0]).toMatchObject({
      accountId: 42,
      contractId: 'CON.NQ',
      type: OrderType.Limit,
      side: OrderSide.Ask,
      size: 1,
      limitPrice: 5010,
      customTag: 'my-bracket-tp2',
    });

    // Third TP: 5000 + 60*0.25 = 5015
    expect(calls[2][0]).toMatchObject({
      accountId: 42,
      contractId: 'CON.NQ',
      type: OrderType.Limit,
      side: OrderSide.Ask,
      size: 1,
      limitPrice: 5015,
      customTag: 'my-bracket-tp3',
    });
  });

  it('returns handle with cancel function that cancels all orders', async () => {
    const result = await client.placeMultiTargetBracket({
      accountId: 42,
      contractId: 'CON.NQ',
      side: OrderSide.Bid,
      entryType: OrderType.Limit,
      entrySize: 1,
      limitPrice: 5000,
      targets: [{ ticks: 20, size: 1 }],
      stopLossTicks: 10,
    });

    expect(result.entryOrderId).toBe(100);

    await result.cancel();

    expect(client.orders.cancel).toHaveBeenCalledWith({ accountId: 42, orderId: 100 });
  });

  it('sorts targets by ticks ascending', async () => {
    await client.placeMultiTargetBracket({
      accountId: 42,
      contractId: 'CON.NQ',
      side: OrderSide.Bid,
      entryType: OrderType.Limit,
      entrySize: 3,
      limitPrice: 5000,
      targets: [
        { ticks: 60, size: 1 },
        { ticks: 20, size: 1 },
        { ticks: 40, size: 1 },
      ],
      stopLossTicks: 10,
    });

    const calls = (client.orders.place as MockFn).mock.calls;
    // Native bracket should use the smallest tick value (20)
    expect(calls[0][0].takeProfitBracket.ticks).toBe(20);
  });
});

// ── addBracketToPosition tests ──────────────────────────────────────────────

describe('TopstepXClient addBracketToPosition', () => {
  let client: TopstepXClient;

  const mockLongPosition = {
    id: 1,
    accountId: 42,
    contractId: 'CON.NQ',
    creationTimestamp: '2025-01-01T00:00:00Z',
    type: PositionType.Long,
    size: 2,
    averagePrice: 5000,
  };

  const mockShortPosition = {
    id: 2,
    accountId: 42,
    contractId: 'CON.NQ',
    creationTimestamp: '2025-01-01T00:00:00Z',
    type: PositionType.Short,
    size: 3,
    averagePrice: 5000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    onOrderCallback = null;
    client = new TopstepXClient(config);
    let placeCallCount = 0;
    (client.orders.place as MockFn).mockImplementation(async () => {
      placeCallCount++;
      return 200 + placeCallCount - 1; // 200, 201, ...
    });
    (client.contracts.searchById as MockFn).mockResolvedValue([mockContract]);
  });

  it('throws if no stopLossTicks or takeProfitTicks', async () => {
    await expect(
      client.addBracketToPosition({
        accountId: 42,
        contractId: 'CON.NQ',
      }),
    ).rejects.toThrow('At least one of stopLossTicks or takeProfitTicks is required');
  });

  it('throws if no position found', async () => {
    (client.positions.searchOpen as MockFn).mockResolvedValue([]);

    await expect(
      client.addBracketToPosition({
        accountId: 42,
        contractId: 'CON.NQ',
        stopLossTicks: 20,
      }),
    ).rejects.toThrow('No open position found for contract CON.NQ on account 42');
  });

  it('places SL and TP for Long position at correct prices', async () => {
    (client.positions.searchOpen as MockFn).mockResolvedValue([mockLongPosition]);

    const result = await client.addBracketToPosition({
      accountId: 42,
      contractId: 'CON.NQ',
      stopLossTicks: 20,
      takeProfitTicks: 40,
    });

    expect(result.stopLossOrderId).toBe(200);
    expect(result.takeProfitOrderId).toBe(201);

    const calls = (client.orders.place as MockFn).mock.calls;

    // SL: sell stop below avgPrice. 5000 - 20*0.25 = 4995
    expect(calls[0][0]).toMatchObject({
      accountId: 42,
      contractId: 'CON.NQ',
      type: OrderType.Stop,
      side: OrderSide.Ask,
      size: 2,
      stopPrice: 4995,
    });

    // TP: sell limit above avgPrice. 5000 + 40*0.25 = 5010
    expect(calls[1][0]).toMatchObject({
      accountId: 42,
      contractId: 'CON.NQ',
      type: OrderType.Limit,
      side: OrderSide.Ask,
      size: 2,
      limitPrice: 5010,
    });
  });

  it('places SL and TP for Short position at correct prices', async () => {
    (client.positions.searchOpen as MockFn).mockResolvedValue([mockShortPosition]);

    const result = await client.addBracketToPosition({
      accountId: 42,
      contractId: 'CON.NQ',
      stopLossTicks: 10,
      takeProfitTicks: 30,
    });

    expect(result.stopLossOrderId).toBe(200);
    expect(result.takeProfitOrderId).toBe(201);

    const calls = (client.orders.place as MockFn).mock.calls;

    // SL: buy stop above avgPrice. 5000 + 10*0.25 = 5002.5
    expect(calls[0][0]).toMatchObject({
      accountId: 42,
      contractId: 'CON.NQ',
      type: OrderType.Stop,
      side: OrderSide.Bid,
      size: 3,
      stopPrice: 5002.5,
    });

    // TP: buy limit below avgPrice. 5000 - 30*0.25 = 4992.5
    expect(calls[1][0]).toMatchObject({
      accountId: 42,
      contractId: 'CON.NQ',
      type: OrderType.Limit,
      side: OrderSide.Bid,
      size: 3,
      limitPrice: 4992.5,
    });
  });

  it('places only SL when only stopLossTicks provided', async () => {
    (client.positions.searchOpen as MockFn).mockResolvedValue([mockLongPosition]);

    const result = await client.addBracketToPosition({
      accountId: 42,
      contractId: 'CON.NQ',
      stopLossTicks: 20,
    });

    expect(result.stopLossOrderId).toBe(200);
    expect(result.takeProfitOrderId).toBeNull();
    expect(client.orders.place).toHaveBeenCalledTimes(1);
  });

  it('places only TP when only takeProfitTicks provided', async () => {
    (client.positions.searchOpen as MockFn).mockResolvedValue([mockLongPosition]);

    const result = await client.addBracketToPosition({
      accountId: 42,
      contractId: 'CON.NQ',
      takeProfitTicks: 40,
    });

    expect(result.stopLossOrderId).toBeNull();
    expect(result.takeProfitOrderId).toBe(200);
    expect(client.orders.place).toHaveBeenCalledTimes(1);
  });

  it('uses custom SL and TP order types when provided', async () => {
    (client.positions.searchOpen as MockFn).mockResolvedValue([mockLongPosition]);

    await client.addBracketToPosition({
      accountId: 42,
      contractId: 'CON.NQ',
      stopLossTicks: 20,
      takeProfitTicks: 40,
      stopLossType: OrderType.StopLimit,
      takeProfitType: OrderType.Market,
    });

    const calls = (client.orders.place as MockFn).mock.calls;
    expect(calls[0][0].type).toBe(OrderType.StopLimit);
    expect(calls[1][0].type).toBe(OrderType.Market);
  });
});
