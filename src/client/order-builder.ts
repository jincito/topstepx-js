import { OrderSide, OrderType } from '../types/enums.js';
import type { PlaceOrderRequest, BracketConfig } from '../types/order.js';
import type { Contract } from '../types/contract.js';

/** Internal state for the order builder */
interface OrderBuilderState {
  accountId: number;
  contractId: string | null;
  type: OrderType | null;
  side: OrderSide | null;
  size: number | null;
  limitPrice: number | null;
  stopPrice: number | null;
  trailPrice: number | null;
  customTag: string | null;
  stopLossBracket: BracketConfig | null;
  takeProfitBracket: BracketConfig | null;
}

/**
 * Fluent order builder with runtime validation and tick alignment checks.
 *
 * @example
 * ```typescript
 * const orderId = await client
 *   .order(accountId)
 *   .buy()
 *   .limit(4500.25)
 *   .size(2)
 *   .contract('CON.F.US.ENQ25')
 *   .withStopLoss(20)
 *   .withTakeProfit(40)
 *   .place();
 * ```
 */
export class OrderBuilder {
  private readonly state: OrderBuilderState;
  private readonly orderService: { place(request: PlaceOrderRequest): Promise<number> };
  private readonly contractResolver: (contractId: string) => Promise<Contract | null>;

  constructor(
    accountId: number,
    orderService: { place(request: PlaceOrderRequest): Promise<number> },
    contractResolver: (contractId: string) => Promise<Contract | null>,
  ) {
    this.orderService = orderService;
    this.contractResolver = contractResolver;
    this.state = {
      accountId,
      contractId: null,
      type: null,
      side: null,
      size: null,
      limitPrice: null,
      stopPrice: null,
      trailPrice: null,
      customTag: null,
      stopLossBracket: null,
      takeProfitBracket: null,
    };
  }

  // ── Fluent setters ──────────────────────────────────────────────

  /** Set side to Buy (Bid). */
  buy(): this {
    this.state.side = OrderSide.Bid;
    return this;
  }

  /** Set side to Sell (Ask). */
  sell(): this {
    this.state.side = OrderSide.Ask;
    return this;
  }

  /** Set order type to Market. */
  market(): this {
    this.state.type = OrderType.Market;
    return this;
  }

  /** Set order type to Limit with the given price. */
  limit(price: number): this {
    this.state.type = OrderType.Limit;
    this.state.limitPrice = price;
    return this;
  }

  /** Set order type to Stop with the given trigger price. */
  stop(price: number): this {
    this.state.type = OrderType.Stop;
    this.state.stopPrice = price;
    return this;
  }

  /** Set order type to StopLimit with stop and limit prices. */
  stopLimit(stopPrice: number, limitPrice: number): this {
    this.state.type = OrderType.StopLimit;
    this.state.stopPrice = stopPrice;
    this.state.limitPrice = limitPrice;
    return this;
  }

  /** Set order type to TrailingStop with the given trail price. */
  trailingStop(trailPrice: number): this {
    this.state.type = OrderType.TrailingStop;
    this.state.trailPrice = trailPrice;
    return this;
  }

  /** Set the order quantity. */
  size(qty: number): this {
    this.state.size = qty;
    return this;
  }

  /** Set the contract ID for this order. */
  contract(contractId: string): this {
    this.state.contractId = contractId;
    return this;
  }

  /** Attach a stop-loss bracket (in ticks). */
  withStopLoss(ticks: number, type: OrderType = OrderType.Stop): this {
    this.state.stopLossBracket = { ticks, type };
    return this;
  }

  /** Attach a take-profit bracket (in ticks). */
  withTakeProfit(ticks: number, type: OrderType = OrderType.Limit): this {
    this.state.takeProfitBracket = { ticks, type };
    return this;
  }

  /** Set a custom tag for the order. */
  tag(customTag: string): this {
    this.state.customTag = customTag;
    return this;
  }

  // ── Terminal method ─────────────────────────────────────────────

  /** Validate and place the order. Returns the order ID. */
  async place(): Promise<number> {
    this.validate();

    if (this.state.contractId) {
      const contract = await this.contractResolver(this.state.contractId);
      if (contract) {
        this.validateTickAlignment(contract);
      }
    }

    const request: PlaceOrderRequest = {
      accountId: this.state.accountId,
      contractId: this.state.contractId!,
      type: this.state.type!,
      side: this.state.side!,
      size: this.state.size!,
      limitPrice: this.state.limitPrice,
      stopPrice: this.state.stopPrice,
      trailPrice: this.state.trailPrice,
      customTag: this.state.customTag,
      stopLossBracket: this.state.stopLossBracket,
      takeProfitBracket: this.state.takeProfitBracket,
    };

    return this.orderService.place(request);
  }

  // ── Private validation ──────────────────────────────────────────

  private validate(): void {
    const errors: string[] = [];

    if (!this.state.contractId) {
      errors.push('contractId is required -- call contract()');
    }
    if (this.state.type === null) {
      errors.push('order type is required -- call market(), limit(), stop(), etc.');
    }
    if (this.state.side === null) {
      errors.push('order side is required -- call buy() or sell()');
    }
    if (this.state.size === null || this.state.size <= 0) {
      errors.push('size must be positive -- call size()');
    }

    // Type-specific checks
    if (this.state.type === OrderType.Limit && this.state.limitPrice === null) {
      errors.push('Limit order requires limitPrice');
    }
    if (this.state.type === OrderType.Stop && this.state.stopPrice === null) {
      errors.push('Stop order requires stopPrice');
    }
    if (this.state.type === OrderType.StopLimit) {
      if (this.state.stopPrice === null) {
        errors.push('StopLimit order requires stopPrice');
      }
      if (this.state.limitPrice === null) {
        errors.push('StopLimit order requires limitPrice');
      }
    }
    if (this.state.type === OrderType.TrailingStop && this.state.trailPrice === null) {
      errors.push('TrailingStop order requires trailPrice');
    }

    if (errors.length > 0) {
      throw new Error('Order validation failed: ' + errors.join('; '));
    }
  }

  private validateTickAlignment(contract: Contract): void {
    const tick = contract.tickSize;

    const check = (name: string, value: number | null): void => {
      if (value !== null && tick > 0) {
        const remainder = Math.abs(value % tick);
        if (remainder > 1e-10 && Math.abs(remainder - tick) > 1e-10) {
          throw new Error(
            `${name} (${value}) is not aligned to tick size ${tick} for contract ${contract.id}`,
          );
        }
      }
    };

    check('limitPrice', this.state.limitPrice);
    check('stopPrice', this.state.stopPrice);
    check('trailPrice', this.state.trailPrice);
  }
}
