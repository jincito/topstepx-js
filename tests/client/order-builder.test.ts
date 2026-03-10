import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderBuilder } from '../../src/client/order-builder.js';
import { OrderSide, OrderType } from '../../src/types/enums.js';
import type { PlaceOrderRequest } from '../../src/types/order.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const CONTRACT_ID = 'CON.F.US.ENQ.U25';
const ACCOUNT_ID = 42;
const MOCK_ORDER_ID = 9056;

function createMocks() {
  const orderService = { place: vi.fn().mockResolvedValue(MOCK_ORDER_ID) };
  const contractResolver = vi.fn().mockResolvedValue({
    id: CONTRACT_ID,
    name: 'E-mini NASDAQ-100',
    description: 'E-mini NASDAQ-100 Futures',
    tickSize: 0.25,
    tickValue: 5,
    activeContract: true,
    symbolId: 'NQ',
  });
  const builder = new OrderBuilder(ACCOUNT_ID, orderService as any, contractResolver);
  return { orderService, contractResolver, builder };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('OrderBuilder', () => {
  let orderService: ReturnType<typeof createMocks>['orderService'];
  let contractResolver: ReturnType<typeof createMocks>['contractResolver'];
  let builder: OrderBuilder;

  beforeEach(() => {
    vi.clearAllMocks();
    const mocks = createMocks();
    orderService = mocks.orderService;
    contractResolver = mocks.contractResolver;
    builder = mocks.builder;
  });

  // ── Validation errors (required fields) ─────────────────────────────────

  describe('validation', () => {
    it('throws when contractId is missing', async () => {
      await expect(
        builder.buy().market().size(1).place(),
      ).rejects.toThrow('contractId is required');
    });

    it('throws when order side is missing', async () => {
      await expect(
        builder.market().size(1).contract(CONTRACT_ID).place(),
      ).rejects.toThrow('order side is required');
    });

    it('throws when order type is missing', async () => {
      await expect(
        builder.buy().size(1).contract(CONTRACT_ID).place(),
      ).rejects.toThrow('order type is required');
    });

    it('throws when size is zero', async () => {
      await expect(
        builder.buy().market().size(0).contract(CONTRACT_ID).place(),
      ).rejects.toThrow('size must be positive');
    });

    it('throws when size is negative', async () => {
      await expect(
        builder.buy().market().size(-5).contract(CONTRACT_ID).place(),
      ).rejects.toThrow('size must be positive');
    });

    it('throws when size is not set (null)', async () => {
      await expect(
        builder.buy().market().contract(CONTRACT_ID).place(),
      ).rejects.toThrow('size must be positive');
    });

    it('collects multiple validation errors into a single message', async () => {
      // No contract, no side, no type, no size -- all four should appear
      await expect(builder.place()).rejects.toThrow(
        /contractId is required.*order type is required.*order side is required.*size must be positive/,
      );
    });

    it('joins multiple errors with semicolons', async () => {
      try {
        await builder.place();
        expect.fail('should have thrown');
      } catch (err: any) {
        expect(err.message).toContain('; ');
        // Verify all four errors present
        expect(err.message).toContain('contractId is required');
        expect(err.message).toContain('order type is required');
        expect(err.message).toContain('order side is required');
        expect(err.message).toContain('size must be positive');
      }
    });
  });

  // ── Type-specific validation ────────────────────────────────────────────

  describe('type-specific validation', () => {
    it('throws when Limit order has no limitPrice', async () => {
      // Manually set type to Limit without calling limit(price) -- impossible via public API
      // because limit() always sets both. Instead, test the message by checking that the
      // builder correctly handles the Limit type. We need to reach this path, which requires
      // setting type = Limit but limitPrice = null. The only way is via the private state,
      // but we can't do that. Instead, this validation path can't be triggered by the public API
      // because .limit(price) always sets both type AND limitPrice.
      //
      // For a proper unit test, we verify the validation message exists by accessing internals.
      // The implementation uses OrderType.Limit check, so we just verify the code path is correct
      // by constructing an object that triggers it via internal state manipulation:
      const b = new OrderBuilder(ACCOUNT_ID, orderService as any, contractResolver);
      // Access private state to create the condition
      (b as any).state.type = OrderType.Limit;
      (b as any).state.side = OrderSide.Bid;
      (b as any).state.size = 1;
      (b as any).state.contractId = CONTRACT_ID;
      // limitPrice is null by default
      await expect(b.place()).rejects.toThrow('Limit order requires limitPrice');
    });

    it('throws when Stop order has no stopPrice', async () => {
      const b = new OrderBuilder(ACCOUNT_ID, orderService as any, contractResolver);
      (b as any).state.type = OrderType.Stop;
      (b as any).state.side = OrderSide.Bid;
      (b as any).state.size = 1;
      (b as any).state.contractId = CONTRACT_ID;
      await expect(b.place()).rejects.toThrow('Stop order requires stopPrice');
    });

    it('throws when StopLimit order has no stopPrice', async () => {
      const b = new OrderBuilder(ACCOUNT_ID, orderService as any, contractResolver);
      (b as any).state.type = OrderType.StopLimit;
      (b as any).state.side = OrderSide.Bid;
      (b as any).state.size = 1;
      (b as any).state.contractId = CONTRACT_ID;
      (b as any).state.limitPrice = 21500.00;
      await expect(b.place()).rejects.toThrow('StopLimit order requires stopPrice');
    });

    it('throws when StopLimit order has no limitPrice', async () => {
      const b = new OrderBuilder(ACCOUNT_ID, orderService as any, contractResolver);
      (b as any).state.type = OrderType.StopLimit;
      (b as any).state.side = OrderSide.Bid;
      (b as any).state.size = 1;
      (b as any).state.contractId = CONTRACT_ID;
      (b as any).state.stopPrice = 21500.00;
      await expect(b.place()).rejects.toThrow('StopLimit order requires limitPrice');
    });

    it('throws when TrailingStop order has no trailPrice', async () => {
      const b = new OrderBuilder(ACCOUNT_ID, orderService as any, contractResolver);
      (b as any).state.type = OrderType.TrailingStop;
      (b as any).state.side = OrderSide.Bid;
      (b as any).state.size = 1;
      (b as any).state.contractId = CONTRACT_ID;
      await expect(b.place()).rejects.toThrow('TrailingStop order requires trailPrice');
    });
  });

  // ── Tick alignment validation ───────────────────────────────────────────

  describe('tick alignment', () => {
    it('throws when limitPrice is not aligned to tick size', async () => {
      await expect(
        builder.buy().limit(21500.13).size(1).contract(CONTRACT_ID).place(),
      ).rejects.toThrow('not aligned to tick size');
    });

    it('does not throw when limitPrice is aligned to tick size', async () => {
      const orderId = await builder
        .buy()
        .limit(21500.25)
        .size(1)
        .contract(CONTRACT_ID)
        .place();

      expect(orderId).toBe(MOCK_ORDER_ID);
    });

    it('handles floating-point edge case correctly (21500.50 % 0.25)', async () => {
      // This price is perfectly aligned but naive modulo might fail due to FP
      const orderId = await builder
        .buy()
        .limit(21500.50)
        .size(1)
        .contract(CONTRACT_ID)
        .place();

      expect(orderId).toBe(MOCK_ORDER_ID);
    });

    it('throws for stopPrice not aligned to tick size', async () => {
      await expect(
        builder.sell().stop(21500.10).size(1).contract(CONTRACT_ID).place(),
      ).rejects.toThrow('not aligned to tick size');
    });

    it('skips tick validation when contract resolver returns null', async () => {
      contractResolver.mockResolvedValue(null);

      const orderId = await builder
        .buy()
        .limit(21500.13) // unaligned, but no contract -> no tick check
        .size(1)
        .contract(CONTRACT_ID)
        .place();

      expect(orderId).toBe(MOCK_ORDER_ID);
    });
  });

  // ── Successful placement ────────────────────────────────────────────────

  describe('successful placement', () => {
    it('places a market order with correct request', async () => {
      const orderId = await builder
        .buy()
        .market()
        .size(1)
        .contract(CONTRACT_ID)
        .place();

      expect(orderId).toBe(MOCK_ORDER_ID);
      expect(orderService.place).toHaveBeenCalledOnce();

      const req: PlaceOrderRequest = orderService.place.mock.calls[0][0];
      expect(req.accountId).toBe(ACCOUNT_ID);
      expect(req.contractId).toBe(CONTRACT_ID);
      expect(req.type).toBe(OrderType.Market);
      expect(req.side).toBe(OrderSide.Bid);
      expect(req.size).toBe(1);
    });

    it('places a limit order with brackets', async () => {
      const orderId = await builder
        .buy()
        .limit(21500.25)
        .size(2)
        .contract(CONTRACT_ID)
        .withStopLoss(20)
        .withTakeProfit(40)
        .place();

      expect(orderId).toBe(MOCK_ORDER_ID);

      const req: PlaceOrderRequest = orderService.place.mock.calls[0][0];
      expect(req.type).toBe(OrderType.Limit);
      expect(req.side).toBe(OrderSide.Bid);
      expect(req.size).toBe(2);
      expect(req.limitPrice).toBe(21500.25);
      expect(req.stopLossBracket).toEqual({ ticks: 20, type: OrderType.Stop });
      expect(req.takeProfitBracket).toEqual({ ticks: 40, type: OrderType.Limit });
    });

    it('places a stop order (sell side)', async () => {
      const orderId = await builder
        .sell()
        .stop(21490.00)
        .size(1)
        .contract(CONTRACT_ID)
        .place();

      expect(orderId).toBe(MOCK_ORDER_ID);

      const req: PlaceOrderRequest = orderService.place.mock.calls[0][0];
      expect(req.type).toBe(OrderType.Stop);
      expect(req.side).toBe(OrderSide.Ask);
      expect(req.stopPrice).toBe(21490.00);
    });

    it('places a stop-limit order', async () => {
      const orderId = await builder
        .buy()
        .stopLimit(21490, 21489.75)
        .size(1)
        .contract(CONTRACT_ID)
        .place();

      expect(orderId).toBe(MOCK_ORDER_ID);

      const req: PlaceOrderRequest = orderService.place.mock.calls[0][0];
      expect(req.type).toBe(OrderType.StopLimit);
      expect(req.stopPrice).toBe(21490);
      expect(req.limitPrice).toBe(21489.75);
    });

    it('places a trailing stop order', async () => {
      const orderId = await builder
        .sell()
        .trailingStop(5.0)
        .size(1)
        .contract(CONTRACT_ID)
        .place();

      expect(orderId).toBe(MOCK_ORDER_ID);

      const req: PlaceOrderRequest = orderService.place.mock.calls[0][0];
      expect(req.type).toBe(OrderType.TrailingStop);
      expect(req.side).toBe(OrderSide.Ask);
      expect(req.trailPrice).toBe(5.0);
    });

    it('includes customTag when tag() is called', async () => {
      const orderId = await builder
        .buy()
        .market()
        .size(1)
        .contract(CONTRACT_ID)
        .tag('my-strategy')
        .place();

      expect(orderId).toBe(MOCK_ORDER_ID);

      const req: PlaceOrderRequest = orderService.place.mock.calls[0][0];
      expect(req.customTag).toBe('my-strategy');
    });

    it('returns the orderId from OrderService.place()', async () => {
      orderService.place.mockResolvedValue(12345);

      const orderId = await builder
        .buy()
        .market()
        .size(1)
        .contract(CONTRACT_ID)
        .place();

      expect(orderId).toBe(12345);
    });

    it('passes null for optional fields when not set', async () => {
      await builder
        .buy()
        .market()
        .size(1)
        .contract(CONTRACT_ID)
        .place();

      const req: PlaceOrderRequest = orderService.place.mock.calls[0][0];
      expect(req.limitPrice).toBeNull();
      expect(req.stopPrice).toBeNull();
      expect(req.trailPrice).toBeNull();
      expect(req.customTag).toBeNull();
      expect(req.stopLossBracket).toBeNull();
      expect(req.takeProfitBracket).toBeNull();
    });
  });

  // ── Fluent chaining ─────────────────────────────────────────────────────

  describe('fluent chaining', () => {
    it('each setter returns the same builder instance', () => {
      expect(builder.buy()).toBe(builder);
      expect(builder.sell()).toBe(builder);
      expect(builder.market()).toBe(builder);
      expect(builder.limit(100)).toBe(builder);
      expect(builder.stop(100)).toBe(builder);
      expect(builder.stopLimit(100, 99)).toBe(builder);
      expect(builder.trailingStop(5)).toBe(builder);
      expect(builder.size(1)).toBe(builder);
      expect(builder.contract('C1')).toBe(builder);
      expect(builder.withStopLoss(10)).toBe(builder);
      expect(builder.withTakeProfit(20)).toBe(builder);
      expect(builder.tag('test')).toBe(builder);
    });

    it('allows methods in any order', async () => {
      // contract -> size -> buy -> limit (reversed order)
      const orderId = await builder
        .contract(CONTRACT_ID)
        .size(3)
        .buy()
        .limit(21500.00)
        .place();

      expect(orderId).toBe(MOCK_ORDER_ID);

      const req: PlaceOrderRequest = orderService.place.mock.calls[0][0];
      expect(req.contractId).toBe(CONTRACT_ID);
      expect(req.size).toBe(3);
      expect(req.side).toBe(OrderSide.Bid);
      expect(req.type).toBe(OrderType.Limit);
      expect(req.limitPrice).toBe(21500.00);
    });

    it('allows tag and brackets before type/side', async () => {
      const orderId = await builder
        .tag('early-tag')
        .withStopLoss(10)
        .withTakeProfit(20)
        .contract(CONTRACT_ID)
        .buy()
        .limit(21500.00)
        .size(1)
        .place();

      expect(orderId).toBe(MOCK_ORDER_ID);

      const req: PlaceOrderRequest = orderService.place.mock.calls[0][0];
      expect(req.customTag).toBe('early-tag');
      expect(req.stopLossBracket).toEqual({ ticks: 10, type: OrderType.Stop });
      expect(req.takeProfitBracket).toEqual({ ticks: 20, type: OrderType.Limit });
    });
  });

  // ── Bracket defaults ────────────────────────────────────────────────────

  describe('bracket defaults', () => {
    it('withStopLoss defaults to Stop type', async () => {
      await builder
        .buy()
        .market()
        .size(1)
        .contract(CONTRACT_ID)
        .withStopLoss(15)
        .place();

      const req: PlaceOrderRequest = orderService.place.mock.calls[0][0];
      expect(req.stopLossBracket).toEqual({ ticks: 15, type: OrderType.Stop });
    });

    it('withTakeProfit defaults to Limit type', async () => {
      await builder
        .buy()
        .market()
        .size(1)
        .contract(CONTRACT_ID)
        .withTakeProfit(30)
        .place();

      const req: PlaceOrderRequest = orderService.place.mock.calls[0][0];
      expect(req.takeProfitBracket).toEqual({ ticks: 30, type: OrderType.Limit });
    });

    it('withStopLoss accepts custom order type', async () => {
      await builder
        .buy()
        .market()
        .size(1)
        .contract(CONTRACT_ID)
        .withStopLoss(15, OrderType.TrailingStop)
        .place();

      const req: PlaceOrderRequest = orderService.place.mock.calls[0][0];
      expect(req.stopLossBracket).toEqual({ ticks: 15, type: OrderType.TrailingStop });
    });
  });
});
