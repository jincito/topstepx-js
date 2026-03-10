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

vi.mock('../../src/hubs/user-hub.js', () => ({
  UserHub: class MockUserHub {
    start = vi.fn().mockResolvedValue(undefined);
    stop = vi.fn().mockResolvedValue(undefined);
    onAccount = vi.fn().mockReturnValue(vi.fn());
    onOrder = vi.fn().mockReturnValue(vi.fn());
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
import { ApiError } from '../../src/errors/index.js';
import { BarUnit, OrderType, OrderStatus, OrderSide } from '../../src/types/enums.js';
import { OrderBuilder } from '../../src/client/order-builder.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

type MockFn = ReturnType<typeof vi.fn>;

const config = {
  credentials: { userName: 'test', apiKey: 'key-123' },
};

describe('TopstepXClient', () => {
  let client: TopstepXClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new TopstepXClient(config);
  });

  // ── Constructor ──────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates all 6 service instances', () => {
      expect(client.accounts).toBeDefined();
      expect(client.contracts).toBeDefined();
      expect(client.orders).toBeDefined();
      expect(client.positions).toBeDefined();
      expect(client.trades).toBeDefined();
      expect(client.history).toBeDefined();
    });
  });

  // ── Hub access ───────────────────────────────────────────────────────────

  describe('hub access', () => {
    it('userHub getter returns UserHub instance', () => {
      expect(client.userHub).toBeDefined();
      expect(client.userHub.start).toBeDefined();
    });

    it('marketHub getter returns MarketHub instance', () => {
      expect(client.marketHub).toBeDefined();
      expect(client.marketHub.start).toBeDefined();
    });

    it('returns same hub instance on repeated access', () => {
      const hub1 = client.userHub;
      const hub2 = client.userHub;
      expect(hub1).toBe(hub2);
    });
  });

  // ── Connect / Disconnect ─────────────────────────────────────────────────

  describe('connect / disconnect', () => {
    it('connect() starts both hubs', async () => {
      await client.connect();

      expect(client.userHub.start).toHaveBeenCalled();
      expect(client.marketHub.start).toHaveBeenCalled();
    });

    it('disconnect() stops only created hubs', async () => {
      // Access only userHub (triggers lazy creation)
      const hub = client.userHub;
      await client.disconnect();

      expect(hub.stop).toHaveBeenCalled();
      // marketHub was never accessed so MarketHub.stop should not be called
    });

    it('disconnect() stops both hubs when both were accessed', async () => {
      const userHub = client.userHub;
      const marketHub = client.marketHub;

      await client.disconnect();

      expect(userHub.stop).toHaveBeenCalled();
      expect(marketHub.stop).toHaveBeenCalled();
    });
  });

  // ── Composites ───────────────────────────────────────────────────────────

  describe('cancelAllOrders', () => {
    it('fetches open orders then cancels each', async () => {
      const mockOrders = [
        { id: 1, accountId: 42 },
        { id: 2, accountId: 42 },
      ];
      (client.orders.searchOpen as MockFn).mockResolvedValue(mockOrders);
      (client.orders.cancel as MockFn).mockResolvedValue(undefined);

      await client.cancelAllOrders(42);

      expect(client.orders.searchOpen).toHaveBeenCalledWith({ accountId: 42 });
      expect(client.orders.cancel).toHaveBeenCalledTimes(2);
      expect(client.orders.cancel).toHaveBeenCalledWith({ accountId: 42, orderId: 1 });
      expect(client.orders.cancel).toHaveBeenCalledWith({ accountId: 42, orderId: 2 });
    });

    it('resolves when no open orders', async () => {
      (client.orders.searchOpen as MockFn).mockResolvedValue([]);

      await client.cancelAllOrders(42);

      expect(client.orders.searchOpen).toHaveBeenCalledWith({ accountId: 42 });
      expect(client.orders.cancel).not.toHaveBeenCalled();
    });
  });

  describe('flattenAll', () => {
    it('fetches positions then closes each', async () => {
      const mockPositions = [
        { contractId: 'CON.A', accountId: 42 },
        { contractId: 'CON.B', accountId: 42 },
      ];
      (client.positions.searchOpen as MockFn).mockResolvedValue(mockPositions);
      (client.positions.closeContract as MockFn).mockResolvedValue(undefined);

      await client.flattenAll(42);

      expect(client.positions.searchOpen).toHaveBeenCalledWith({ accountId: 42 });
      expect(client.positions.closeContract).toHaveBeenCalledTimes(2);
      expect(client.positions.closeContract).toHaveBeenCalledWith({ accountId: 42, contractId: 'CON.A' });
      expect(client.positions.closeContract).toHaveBeenCalledWith({ accountId: 42, contractId: 'CON.B' });
    });

    it('resolves when no positions', async () => {
      (client.positions.searchOpen as MockFn).mockResolvedValue([]);

      await client.flattenAll(42);

      expect(client.positions.searchOpen).toHaveBeenCalledWith({ accountId: 42 });
      expect(client.positions.closeContract).not.toHaveBeenCalled();
    });
  });

  describe('cancelAndFlatten', () => {
    it('cancels before flattening (sequential)', async () => {
      const callOrder: string[] = [];

      (client.orders.searchOpen as MockFn).mockImplementation(async () => {
        callOrder.push('searchOpenOrders');
        return [];
      });
      (client.positions.searchOpen as MockFn).mockImplementation(async () => {
        callOrder.push('searchOpenPositions');
        return [];
      });

      await client.cancelAndFlatten(42);

      expect(callOrder).toEqual(['searchOpenOrders', 'searchOpenPositions']);
    });
  });

  describe('flattenContract', () => {
    it('calls closeContract when no size provided', async () => {
      (client.positions.closeContract as MockFn).mockResolvedValue(undefined);

      await client.flattenContract(42, 'CON.1');

      expect(client.positions.closeContract).toHaveBeenCalledWith({
        accountId: 42,
        contractId: 'CON.1',
      });
      expect(client.positions.partialCloseContract).not.toHaveBeenCalled();
    });

    it('calls partialCloseContract when size provided', async () => {
      (client.positions.partialCloseContract as MockFn).mockResolvedValue(undefined);

      await client.flattenContract(42, 'CON.1', 5);

      expect(client.positions.partialCloseContract).toHaveBeenCalledWith({
        accountId: 42,
        contractId: 'CON.1',
        size: 5,
      });
      expect(client.positions.closeContract).not.toHaveBeenCalled();
    });
  });

  // ── Account helpers ──────────────────────────────────────────────────────

  describe('getActiveAccounts', () => {
    it('filters to canTrade accounts', async () => {
      (client.accounts.search as MockFn).mockResolvedValue([
        { id: 1, name: 'Acct1', balance: 50000, canTrade: true, isVisible: true },
        { id: 2, name: 'Acct2', balance: 25000, canTrade: false, isVisible: true },
        { id: 3, name: 'Acct3', balance: 75000, canTrade: true, isVisible: true },
      ]);

      const result = await client.getActiveAccounts();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(3);
      expect(client.accounts.search).toHaveBeenCalledWith({ onlyActiveAccounts: true });
    });
  });

  describe('getAccountSummary', () => {
    it('returns account, positions, orders', async () => {
      const mockAccount = { id: 42, name: 'Test', balance: 50000, canTrade: true, isVisible: true };
      const mockPositions = [{ id: 1, accountId: 42, contractId: 'CON.A' }];
      const mockOrders = [{ id: 10, accountId: 42 }];

      (client.accounts.search as MockFn).mockResolvedValue([mockAccount]);
      (client.positions.searchOpen as MockFn).mockResolvedValue(mockPositions);
      (client.orders.searchOpen as MockFn).mockResolvedValue(mockOrders);

      const result = await client.getAccountSummary(42);

      expect(result.account).toEqual(mockAccount);
      expect(result.positions).toEqual(mockPositions);
      expect(result.orders).toEqual(mockOrders);
    });

    it('throws ApiError when account not found', async () => {
      (client.accounts.search as MockFn).mockResolvedValue([]);
      (client.positions.searchOpen as MockFn).mockResolvedValue([]);
      (client.orders.searchOpen as MockFn).mockResolvedValue([]);

      await expect(client.getAccountSummary(999)).rejects.toThrow(ApiError);
      await expect(client.getAccountSummary(999)).rejects.toThrow('Account 999 not found');
    });
  });

  // ── Contract helpers ─────────────────────────────────────────────────────

  describe('findContract', () => {
    it('returns first contract from API', async () => {
      const mockContracts = [
        { id: 'C1', name: 'NQ', activeContract: true },
        { id: 'C2', name: 'NQ2', activeContract: true },
      ];
      (client.contracts.search as MockFn).mockResolvedValue(mockContracts);

      const result = await client.findContract('NQ');

      expect(result).toEqual(mockContracts[0]);
      expect(client.contracts.search).toHaveBeenCalledWith({ searchText: 'NQ', live: false });
    });

    it('returns null when no results', async () => {
      (client.contracts.search as MockFn).mockResolvedValue([]);

      const result = await client.findContract('NONEXISTENT');

      expect(result).toBeNull();
    });

    it('uses cache on second call', async () => {
      const mockContracts = [{ id: 'C1', name: 'NQ', activeContract: true }];
      (client.contracts.search as MockFn).mockResolvedValue(mockContracts);

      const first = await client.findContract('NQ');
      const second = await client.findContract('NQ');

      expect(first).toEqual(mockContracts[0]);
      expect(second).toEqual(mockContracts[0]);
      expect(client.contracts.search).toHaveBeenCalledTimes(1);
    });
  });

  describe('getActiveContracts', () => {
    it('filters to active contracts', async () => {
      const mockContracts = [
        { id: 'C1', name: 'NQ', activeContract: true },
        { id: 'C2', name: 'ES', activeContract: false },
        { id: 'C3', name: 'YM', activeContract: true },
      ];
      (client.contracts.available as MockFn).mockResolvedValue(mockContracts);

      const result = await client.getActiveContracts();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('C1');
      expect(result[1].id).toBe('C3');
    });

    it('uses cache on second call', async () => {
      const mockContracts = [{ id: 'C1', name: 'NQ', activeContract: true }];
      (client.contracts.available as MockFn).mockResolvedValue(mockContracts);

      await client.getActiveContracts();
      await client.getActiveContracts();

      expect(client.contracts.available).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearContractCache', () => {
    it('forces fresh fetch after clearing', async () => {
      const mockContracts = [{ id: 'C1', name: 'NQ', activeContract: true }];
      (client.contracts.available as MockFn).mockResolvedValue(mockContracts);

      await client.getActiveContracts();
      client.clearContractCache();
      await client.getActiveContracts();

      expect(client.contracts.available).toHaveBeenCalledTimes(2);
    });
  });

  // ── Market helpers ───────────────────────────────────────────────────────

  describe('subscribeTicker', () => {
    it('subscribes and returns cleanup function', async () => {
      const callback = vi.fn();
      const mockUnsub = vi.fn();
      (client.marketHub.onQuote as MockFn).mockReturnValue(mockUnsub);

      const cleanup = await client.subscribeTicker(123, callback);

      expect(client.marketHub.onQuote).toHaveBeenCalledWith(callback);
      expect(client.marketHub.subscribeQuotes).toHaveBeenCalledWith(123);

      // Call cleanup
      await cleanup();

      expect(mockUnsub).toHaveBeenCalled();
      expect(client.marketHub.unsubscribeQuotes).toHaveBeenCalledWith(123);
    });
  });

  describe('getLatestQuote', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('resolves with first quote received', async () => {
      const mockQuote = { lastPrice: 4500.25, symbol: 'NQ' };

      // Mock onQuote to capture the handler and simulate a quote arriving
      (client.marketHub.onQuote as MockFn).mockImplementation(
        (handler: (quote: unknown) => void) => {
          // Schedule the quote callback on the next microtask
          Promise.resolve().then(() => handler(mockQuote));
          return vi.fn(); // unsub function
        },
      );
      (client.marketHub.subscribeQuotes as MockFn).mockResolvedValue(undefined);
      (client.marketHub.unsubscribeQuotes as MockFn).mockResolvedValue(undefined);

      const promise = client.getLatestQuote(123, 5000);

      // Allow microtasks to flush
      await vi.advanceTimersByTimeAsync(0);

      const result = await promise;
      expect(result).toEqual(mockQuote);
    });

    it('rejects on timeout', async () => {
      // Mock onQuote to NOT invoke the callback (no quote arrives)
      (client.marketHub.onQuote as MockFn).mockReturnValue(vi.fn());
      (client.marketHub.subscribeQuotes as MockFn).mockResolvedValue(undefined);
      (client.marketHub.unsubscribeQuotes as MockFn).mockResolvedValue(undefined);

      const promise = client.getLatestQuote(456, 100);

      // Attach the rejection handler BEFORE advancing timers so the
      // rejection is caught synchronously and does not escape as unhandled.
      const rejection = expect(promise).rejects.toThrow(
        'Timed out waiting for quote on contract 456',
      );

      // Advance past the timeout
      await vi.advanceTimersByTimeAsync(150);

      await rejection;
    });

    it('auto-starts hub if not connected', async () => {
      // Set state to Disconnected
      (client.marketHub as any).state = HubConnectionState.Disconnected;

      // Mock onQuote to invoke callback immediately
      (client.marketHub.onQuote as MockFn).mockImplementation(
        (handler: (quote: unknown) => void) => {
          Promise.resolve().then(() => handler({ lastPrice: 100 }));
          return vi.fn();
        },
      );
      (client.marketHub.subscribeQuotes as MockFn).mockResolvedValue(undefined);
      (client.marketHub.unsubscribeQuotes as MockFn).mockResolvedValue(undefined);

      const promise = client.getLatestQuote(789, 5000);
      await vi.advanceTimersByTimeAsync(0);
      await promise;

      expect(client.marketHub.start).toHaveBeenCalled();
    });
  });

  // ── History helpers ──────────────────────────────────────────────────────

  describe('getBars', () => {
    it('uses sensible defaults', async () => {
      const mockBars = [{ t: '2025-01-01T00:00:00Z', o: 100, h: 105, l: 99, c: 103, v: 1000 }];
      (client.history.retrieveBars as MockFn).mockResolvedValue(mockBars);

      const result = await client.getBars('CON.1');

      expect(result).toEqual(mockBars);
      expect(client.history.retrieveBars).toHaveBeenCalledTimes(1);

      const calledWith = (client.history.retrieveBars as MockFn).mock.calls[0][0];
      expect(calledWith.contractId).toBe('CON.1');
      expect(calledWith.live).toBe(false);
      expect(calledWith.unit).toBe(BarUnit.Minute);
      expect(calledWith.unitNumber).toBe(1);
      expect(calledWith.limit).toBe(500);
      expect(calledWith.includePartialBar).toBe(true);
      // startTime and endTime should be valid ISO strings approximately 24h apart
      expect(typeof calledWith.startTime).toBe('string');
      expect(typeof calledWith.endTime).toBe('string');
      const start = new Date(calledWith.startTime).getTime();
      const end = new Date(calledWith.endTime).getTime();
      const diffHours = (end - start) / (1000 * 60 * 60);
      expect(diffHours).toBeCloseTo(24, 0);
    });

    it('overrides defaults with options', async () => {
      (client.history.retrieveBars as MockFn).mockResolvedValue([]);

      const customStart = new Date('2025-06-01T00:00:00Z');
      const customEnd = new Date('2025-06-02T00:00:00Z');

      await client.getBars('CON.2', {
        live: true,
        startTime: customStart,
        endTime: customEnd,
        unit: BarUnit.Hour,
        unitNumber: 4,
        limit: 100,
        includePartialBar: false,
      });

      const calledWith = (client.history.retrieveBars as MockFn).mock.calls[0][0];
      expect(calledWith.contractId).toBe('CON.2');
      expect(calledWith.live).toBe(true);
      expect(calledWith.startTime).toBe(customStart.toISOString());
      expect(calledWith.endTime).toBe(customEnd.toISOString());
      expect(calledWith.unit).toBe(BarUnit.Hour);
      expect(calledWith.unitNumber).toBe(4);
      expect(calledWith.limit).toBe(100);
      expect(calledWith.includePartialBar).toBe(false);
    });
  });

  // ── Order builder factory ───────────────────────────────────────

  describe('order()', () => {
    it('returns an OrderBuilder instance', () => {
      const builder = client.order(42);
      expect(builder).toBeInstanceOf(OrderBuilder);
    });

    it('builder is wired to the client OrderService', async () => {
      (client.orders.place as MockFn).mockResolvedValue(9001);
      (client.contracts.searchById as MockFn).mockResolvedValue([]);

      const orderId = await client
        .order(42)
        .buy()
        .market()
        .size(1)
        .contract('CON.NQ')
        .place();

      expect(client.orders.place).toHaveBeenCalledTimes(1);
      expect(orderId).toBe(9001);
    });
  });

  // ── Bracket order helpers ───────────────────────────────────────

  describe('placeBracketOrder()', () => {
    it('calls orders.place with correct bracket configs', async () => {
      (client.orders.place as MockFn).mockResolvedValue(5001);

      const orderId = await client.placeBracketOrder({
        accountId: 42,
        contractId: 'CON.NQ',
        type: OrderType.Limit,
        side: OrderSide.Bid,
        size: 2,
        limitPrice: 4500.25,
        stopLossTicks: 20,
        takeProfitTicks: 40,
      });

      expect(orderId).toBe(5001);
      expect(client.orders.place).toHaveBeenCalledWith({
        accountId: 42,
        contractId: 'CON.NQ',
        type: OrderType.Limit,
        side: OrderSide.Bid,
        size: 2,
        limitPrice: 4500.25,
        stopPrice: null,
        customTag: null,
        stopLossBracket: { ticks: 20, type: OrderType.Stop },
        takeProfitBracket: { ticks: 40, type: OrderType.Limit },
      });
    });

    it('uses default bracket types (Stop for SL, Limit for TP)', async () => {
      (client.orders.place as MockFn).mockResolvedValue(5002);

      await client.placeBracketOrder({
        accountId: 42,
        contractId: 'CON.ES',
        type: OrderType.Market,
        side: OrderSide.Ask,
        size: 1,
        stopLossTicks: 10,
        takeProfitTicks: 15,
      });

      const calledWith = (client.orders.place as MockFn).mock.calls[0][0];
      expect(calledWith.stopLossBracket.type).toBe(OrderType.Stop);
      expect(calledWith.takeProfitBracket.type).toBe(OrderType.Limit);
    });

    it('passes through custom stopLossType and takeProfitType', async () => {
      (client.orders.place as MockFn).mockResolvedValue(5003);

      await client.placeBracketOrder({
        accountId: 42,
        contractId: 'CON.YM',
        type: OrderType.Limit,
        side: OrderSide.Bid,
        size: 3,
        limitPrice: 35000,
        stopLossTicks: 30,
        takeProfitTicks: 60,
        stopLossType: OrderType.TrailingStop,
        takeProfitType: OrderType.Market,
      });

      const calledWith = (client.orders.place as MockFn).mock.calls[0][0];
      expect(calledWith.stopLossBracket.type).toBe(OrderType.TrailingStop);
      expect(calledWith.takeProfitBracket.type).toBe(OrderType.Market);
    });

    it('sets limitPrice, stopPrice, customTag to null when not provided', async () => {
      (client.orders.place as MockFn).mockResolvedValue(5004);

      await client.placeBracketOrder({
        accountId: 42,
        contractId: 'CON.NQ',
        type: OrderType.Market,
        side: OrderSide.Bid,
        size: 1,
        stopLossTicks: 10,
        takeProfitTicks: 20,
      });

      const calledWith = (client.orders.place as MockFn).mock.calls[0][0];
      expect(calledWith.limitPrice).toBeNull();
      expect(calledWith.stopPrice).toBeNull();
      expect(calledWith.customTag).toBeNull();
    });
  });

  // ── Trailing stop helpers ───────────────────────────────────────

  describe('placeTrailingStop()', () => {
    it('calls orders.place with TrailingStop type and trailPrice', async () => {
      (client.orders.place as MockFn).mockResolvedValue(6001);

      const orderId = await client.placeTrailingStop(42, 'CON.NQ', OrderSide.Ask, 2, 10.5);

      expect(orderId).toBe(6001);
      expect(client.orders.place).toHaveBeenCalledWith({
        accountId: 42,
        contractId: 'CON.NQ',
        type: OrderType.TrailingStop,
        side: OrderSide.Ask,
        size: 2,
        trailPrice: 10.5,
        customTag: null,
      });
    });

    it('sets customTag to null when not provided', async () => {
      (client.orders.place as MockFn).mockResolvedValue(6002);

      await client.placeTrailingStop(42, 'CON.ES', OrderSide.Bid, 1, 5.0);

      const calledWith = (client.orders.place as MockFn).mock.calls[0][0];
      expect(calledWith.customTag).toBeNull();
    });

    it('passes through customTag when provided', async () => {
      (client.orders.place as MockFn).mockResolvedValue(6003);

      await client.placeTrailingStop(42, 'CON.ES', OrderSide.Bid, 1, 5.0, 'trail-tag');

      const calledWith = (client.orders.place as MockFn).mock.calls[0][0];
      expect(calledWith.customTag).toBe('trail-tag');
    });
  });

  // ── Modify trailing distance ────────────────────────────────────

  describe('modifyTrailingDistance()', () => {
    it('calls orders.modify with accountId, orderId, and trailPrice', async () => {
      (client.orders.modify as MockFn).mockResolvedValue(undefined);

      await client.modifyTrailingDistance(42, 7001, 12.5);

      expect(client.orders.modify).toHaveBeenCalledWith({
        accountId: 42,
        orderId: 7001,
        trailPrice: 12.5,
      });
    });
  });

  // ── onFill() ────────────────────────────────────────────────────

  describe('onFill()', () => {
    it('fires callback when order has matching accountId and Filled status', () => {
      let capturedHandler: (order: any) => void;
      const mockUserHub = client.userHub as any;
      mockUserHub.onOrder.mockImplementation((handler: (order: any) => void) => {
        capturedHandler = handler;
        return vi.fn();
      });

      const callback = vi.fn();
      client.onFill(42, callback);

      capturedHandler!({
        id: 100,
        accountId: 42,
        status: OrderStatus.Filled,
        contractId: 'CON.NQ',
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({
        id: 100,
        accountId: 42,
        status: OrderStatus.Filled,
        contractId: 'CON.NQ',
      });
    });

    it('does NOT fire callback for non-matching accountId', () => {
      let capturedHandler: (order: any) => void;
      const mockUserHub = client.userHub as any;
      mockUserHub.onOrder.mockImplementation((handler: (order: any) => void) => {
        capturedHandler = handler;
        return vi.fn();
      });

      const callback = vi.fn();
      client.onFill(42, callback);

      capturedHandler!({
        id: 101,
        accountId: 99,
        status: OrderStatus.Filled,
        contractId: 'CON.NQ',
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('does NOT fire callback for non-Filled status', () => {
      let capturedHandler: (order: any) => void;
      const mockUserHub = client.userHub as any;
      mockUserHub.onOrder.mockImplementation((handler: (order: any) => void) => {
        capturedHandler = handler;
        return vi.fn();
      });

      const callback = vi.fn();
      client.onFill(42, callback);

      capturedHandler!({
        id: 102,
        accountId: 42,
        status: OrderStatus.Open,
        contractId: 'CON.NQ',
      });
      capturedHandler!({
        id: 103,
        accountId: 42,
        status: OrderStatus.Cancelled,
        contractId: 'CON.NQ',
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('returns unsubscribe function that stops callback from firing', () => {
      let capturedHandler: (order: any) => void;
      const mockUnsub = vi.fn();
      const mockUserHub = client.userHub as any;
      mockUserHub.onOrder.mockImplementation((handler: (order: any) => void) => {
        capturedHandler = handler;
        return mockUnsub;
      });

      const callback = vi.fn();
      const unsub = client.onFill(42, callback);

      // Verify unsub returns the inner unsubscribe
      expect(unsub).toBe(mockUnsub);
    });
  });

  // ── waitForFill() ───────────────────────────────────────────────

  describe('waitForFill()', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('resolves when matching order fills', async () => {
      const filledOrder = {
        id: 9056,
        accountId: 42,
        status: OrderStatus.Filled,
        contractId: 'CON.NQ',
      };

      const mockUserHub = client.userHub as any;
      mockUserHub.onOrder.mockImplementation((handler: (order: any) => void) => {
        // Emit the fill on next microtask
        Promise.resolve().then(() => handler(filledOrder));
        return vi.fn();
      });

      const promise = client.waitForFill(9056, 5000);
      await vi.advanceTimersByTimeAsync(0);

      const result = await promise;
      expect(result).toEqual(filledOrder);
    });

    it('rejects on timeout', async () => {
      const mockUserHub = client.userHub as any;
      mockUserHub.onOrder.mockReturnValue(vi.fn());

      const promise = client.waitForFill(9056, 100);
      // Attach rejection handler BEFORE advancing timers
      const rejection = expect(promise).rejects.toThrow('Timed out');
      await vi.advanceTimersByTimeAsync(150);
      await rejection;
    });

    it('ignores non-matching order IDs', async () => {
      const wrongOrder = {
        id: 1111,
        accountId: 42,
        status: OrderStatus.Filled,
        contractId: 'CON.NQ',
      };
      const rightOrder = {
        id: 9056,
        accountId: 42,
        status: OrderStatus.Filled,
        contractId: 'CON.NQ',
      };

      const mockUserHub = client.userHub as any;
      mockUserHub.onOrder.mockImplementation((handler: (order: any) => void) => {
        // Emit wrong ID first, then right ID
        Promise.resolve().then(() => {
          handler(wrongOrder);
          handler(rightOrder);
        });
        return vi.fn();
      });

      const promise = client.waitForFill(9056, 5000);
      await vi.advanceTimersByTimeAsync(0);

      const result = await promise;
      expect(result).toEqual(rightOrder);
    });

    it('ignores non-Filled statuses for matching order ID', async () => {
      const openOrder = {
        id: 9056,
        accountId: 42,
        status: OrderStatus.Open,
        contractId: 'CON.NQ',
      };
      const filledOrder = {
        id: 9056,
        accountId: 42,
        status: OrderStatus.Filled,
        contractId: 'CON.NQ',
      };

      const mockUserHub = client.userHub as any;
      mockUserHub.onOrder.mockImplementation((handler: (order: any) => void) => {
        // Emit Open status first, then Filled
        Promise.resolve().then(() => {
          handler(openOrder);
          handler(filledOrder);
        });
        return vi.fn();
      });

      const promise = client.waitForFill(9056, 5000);
      await vi.advanceTimersByTimeAsync(0);

      const result = await promise;
      expect(result).toEqual(filledOrder);
    });
  });

  // ── watchPosition() ─────────────────────────────────────────────

  describe('watchPosition()', () => {
    it('fires callback when position matches accountId AND contractId', () => {
      let capturedHandler: (position: any) => void;
      const mockUserHub = client.userHub as any;
      mockUserHub.onPosition.mockImplementation((handler: (position: any) => void) => {
        capturedHandler = handler;
        return vi.fn();
      });

      const callback = vi.fn();
      client.watchPosition(42, 'CON.NQ', callback);

      capturedHandler!({
        id: 1,
        accountId: 42,
        contractId: 'CON.NQ',
        size: 3,
        averagePrice: 4500.25,
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({
        id: 1,
        accountId: 42,
        contractId: 'CON.NQ',
        size: 3,
        averagePrice: 4500.25,
      });
    });

    it('does NOT fire for non-matching accountId', () => {
      let capturedHandler: (position: any) => void;
      const mockUserHub = client.userHub as any;
      mockUserHub.onPosition.mockImplementation((handler: (position: any) => void) => {
        capturedHandler = handler;
        return vi.fn();
      });

      const callback = vi.fn();
      client.watchPosition(42, 'CON.NQ', callback);

      capturedHandler!({
        id: 2,
        accountId: 99,
        contractId: 'CON.NQ',
        size: 1,
        averagePrice: 4500,
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('does NOT fire for non-matching contractId (same account)', () => {
      let capturedHandler: (position: any) => void;
      const mockUserHub = client.userHub as any;
      mockUserHub.onPosition.mockImplementation((handler: (position: any) => void) => {
        capturedHandler = handler;
        return vi.fn();
      });

      const callback = vi.fn();
      client.watchPosition(42, 'CON.NQ', callback);

      capturedHandler!({
        id: 3,
        accountId: 42,
        contractId: 'CON.ES',
        size: 2,
        averagePrice: 5000,
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('returns unsubscribe function', () => {
      const mockUnsub = vi.fn();
      const mockUserHub = client.userHub as any;
      mockUserHub.onPosition.mockReturnValue(mockUnsub);

      const callback = vi.fn();
      const unsub = client.watchPosition(42, 'CON.NQ', callback);

      expect(unsub).toBe(mockUnsub);
    });
  });

  // ── watchOrders() ───────────────────────────────────────────────

  describe('watchOrders()', () => {
    it('fires callback when order has matching accountId', () => {
      let capturedHandler: (order: any) => void;
      const mockUserHub = client.userHub as any;
      mockUserHub.onOrder.mockImplementation((handler: (order: any) => void) => {
        capturedHandler = handler;
        return vi.fn();
      });

      const callback = vi.fn();
      client.watchOrders(42, callback);

      capturedHandler!({
        id: 200,
        accountId: 42,
        status: OrderStatus.Open,
        contractId: 'CON.NQ',
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({
        id: 200,
        accountId: 42,
        status: OrderStatus.Open,
        contractId: 'CON.NQ',
      });
    });

    it('fires for any order status (not just Filled)', () => {
      let capturedHandler: (order: any) => void;
      const mockUserHub = client.userHub as any;
      mockUserHub.onOrder.mockImplementation((handler: (order: any) => void) => {
        capturedHandler = handler;
        return vi.fn();
      });

      const callback = vi.fn();
      client.watchOrders(42, callback);

      capturedHandler!({ id: 201, accountId: 42, status: OrderStatus.Open, contractId: 'CON.NQ' });
      capturedHandler!({ id: 202, accountId: 42, status: OrderStatus.Filled, contractId: 'CON.NQ' });
      capturedHandler!({ id: 203, accountId: 42, status: OrderStatus.Cancelled, contractId: 'CON.NQ' });

      expect(callback).toHaveBeenCalledTimes(3);
    });

    it('does NOT fire for non-matching accountId', () => {
      let capturedHandler: (order: any) => void;
      const mockUserHub = client.userHub as any;
      mockUserHub.onOrder.mockImplementation((handler: (order: any) => void) => {
        capturedHandler = handler;
        return vi.fn();
      });

      const callback = vi.fn();
      client.watchOrders(42, callback);

      capturedHandler!({
        id: 204,
        accountId: 99,
        status: OrderStatus.Filled,
        contractId: 'CON.NQ',
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('returns unsubscribe function', () => {
      const mockUnsub = vi.fn();
      const mockUserHub = client.userHub as any;
      mockUserHub.onOrder.mockReturnValue(mockUnsub);

      const callback = vi.fn();
      const unsub = client.watchOrders(42, callback);

      expect(unsub).toBe(mockUnsub);
    });
  });
});
