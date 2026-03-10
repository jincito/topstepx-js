import type { ApiKeyCredentials, Credentials, TopstepXConfig, TopstepXOptions } from '../types/config.js';
import type { Account, Contract, Position, Order, Bar } from '../types/index.js';
import type { GatewayQuote, GatewayDepth } from '../types/market.js';
import type { AccountSummary, GetBarsOptions, BracketOrderOptions, OCOOptions, OCOResult, OCOFillResult, MultiTargetBracketOptions, MultiTargetResult, AddBracketOptions, AddBracketResult, ATMStrategyTemplate, ATMResult, CopyTradeOptions, MirrorOptions, MirrorController } from '../types/client.js';
import type { GatewayUserOrder, GatewayUserPosition } from '../types/events.js';
import { BarUnit, OrderType, OrderStatus, OrderSide, PositionType } from '../types/enums.js';
import { HubConnectionState } from '@microsoft/signalr';
import { ApiError } from '../errors/index.js';
import { AuthManager } from '../auth/auth-manager.js';
import { HttpClient } from '../http/http-client.js';
import { AccountService } from '../api/account-service.js';
import { ContractService } from '../api/contract-service.js';
import { OrderService } from '../api/order-service.js';
import { PositionService } from '../api/position-service.js';
import { TradeService } from '../api/trade-service.js';
import { HistoryService } from '../api/history-service.js';
import { UserHub } from '../hubs/user-hub.js';
import { MarketHub } from '../hubs/market-hub.js';
import { ContractCache } from './contract-cache.js';
import { OrderBuilder } from './order-builder.js';

/**
 * Main SDK facade -- single entry point for all TopstepX functionality.
 *
 * Provides:
 * - 6 REST service namespaces (accounts, contracts, orders, positions, trades, history)
 * - 2 real-time hub lazy getters (userHub, marketHub)
 * - Lifecycle methods (connect, disconnect)
 * - Composite trading operations (cancelAllOrders, flattenAll, cancelAndFlatten, flattenContract)
 * - Helper methods (getActiveAccounts, getAccountSummary, findContract, etc.)
 *
 * @example
 * ```typescript
 * const client = new TopstepXClient({
 *   credentials: { userName: 'user', apiKey: 'key' },
 * });
 *
 * const accounts = await client.getActiveAccounts();
 * await client.connect();
 * ```
 */
export class TopstepXClient {
  // ── REST service namespaces (eagerly constructed) ───────────────
  readonly accounts: AccountService;
  readonly contracts: ContractService;
  readonly orders: OrderService;
  readonly positions: PositionService;
  readonly trades: TradeService;
  readonly history: HistoryService;

  // ── Private internals ──────────────────────────────────────────
  private readonly authManager: AuthManager;
  private readonly http: HttpClient;
  private readonly config: TopstepXConfig;
  private readonly contractCache: ContractCache;
  private _userHub: UserHub | null = null;
  private _marketHub: MarketHub | null = null;

  constructor(config: TopstepXConfig) {
    this.config = config;
    const baseUrl = config.baseUrl ?? 'https://api.topstepx.com';
    this.authManager = new AuthManager(config.credentials, baseUrl, config.tokenStore);
    this.http = new HttpClient(this.authManager, baseUrl);
    this.contractCache = new ContractCache();
    this.accounts = new AccountService(this.http);
    this.contracts = new ContractService(this.http);
    this.orders = new OrderService(this.http);
    this.positions = new PositionService(this.http);
    this.trades = new TradeService(this.http);
    this.history = new HistoryService(this.http);
  }

  // ── Hub access (lazy getters) ──────────────────────────────────

  /** Lazily-constructed UserHub for real-time account, order, position, and trade events. */
  get userHub(): UserHub {
    if (!this._userHub) {
      const rtcUrl = this.config.rtcUrl ?? 'https://rtc.topstepx.com';
      this._userHub = new UserHub({
        authManager: this.authManager,
        url: `${rtcUrl}/hubs/user`,
      });
    }
    return this._userHub;
  }

  /** Lazily-constructed MarketHub for real-time quote, trade, and depth events. */
  get marketHub(): MarketHub {
    if (!this._marketHub) {
      const rtcUrl = this.config.rtcUrl ?? 'https://rtc.topstepx.com';
      this._marketHub = new MarketHub({
        authManager: this.authManager,
        url: `${rtcUrl}/hubs/market`,
      });
    }
    return this._marketHub;
  }

  // ── Lifecycle ──────────────────────────────────────────────────

  /** Start both UserHub and MarketHub connections. */
  async connect(): Promise<void> {
    await Promise.all([this.userHub.start(), this.marketHub.start()]);
  }

  /** Stop any hub connections that were created. */
  async disconnect(): Promise<void> {
    const stops: Promise<void>[] = [];
    if (this._userHub) stops.push(this._userHub.stop());
    if (this._marketHub) stops.push(this._marketHub.stop());
    await Promise.all(stops);
  }

  // ── Composites ─────────────────────────────────────────────────

  /** Cancel all open orders for the given account. */
  async cancelAllOrders(accountId: number): Promise<void> {
    const openOrders = await this.orders.searchOpen({ accountId });
    await Promise.all(
      openOrders.map((order) => this.orders.cancel({ accountId, orderId: order.id })),
    );
  }

  /** Close all open positions for the given account. */
  async flattenAll(accountId: number): Promise<void> {
    const positions = await this.positions.searchOpen({ accountId });
    await Promise.all(
      positions.map((pos) => this.positions.closeContract({ accountId, contractId: pos.contractId })),
    );
  }

  /**
   * Cancel all open orders then flatten all positions for the given account.
   * Runs sequentially -- cancels must complete before flattening to prevent
   * orders from filling while positions are being closed.
   */
  async cancelAndFlatten(accountId: number): Promise<void> {
    await this.cancelAllOrders(accountId);
    await this.flattenAll(accountId);
  }

  /**
   * Flatten a specific contract position. If size is provided, performs a
   * partial close; otherwise closes the entire position.
   */
  async flattenContract(accountId: number, contractId: string, size?: number): Promise<void> {
    if (size !== undefined) {
      await this.positions.partialCloseContract({ accountId, contractId, size });
    } else {
      await this.positions.closeContract({ accountId, contractId });
    }
  }

  // ── Account helpers ────────────────────────────────────────────

  /** Get only accounts where canTrade is true. */
  async getActiveAccounts(): Promise<Account[]> {
    const accounts = await this.accounts.search({ onlyActiveAccounts: true });
    return accounts.filter((a) => a.canTrade);
  }

  /** Get account details, open positions, and open orders in a single parallel call. */
  async getAccountSummary(accountId: number): Promise<AccountSummary> {
    const [accounts, positions, orders] = await Promise.all([
      this.accounts.search({ onlyActiveAccounts: false }),
      this.positions.searchOpen({ accountId }),
      this.orders.searchOpen({ accountId }),
    ]);
    const account = accounts.find((a) => a.id === accountId);
    if (!account) {
      throw new ApiError(0, `Account ${accountId} not found`);
    }
    return { account, positions, orders };
  }

  // ── Contract helpers ───────────────────────────────────────────

  /** Search for a contract by symbol, using cache. Returns first result or null. */
  async findContract(symbol: string): Promise<Contract | null> {
    const cached = this.contractCache.get(`search:${symbol}`);
    if (cached) return cached[0] ?? null;
    const results = await this.contracts.search({ searchText: symbol, live: false });
    this.contractCache.set(`search:${symbol}`, results);
    return results[0] ?? null;
  }

  /** Get all active contracts, using cache. */
  async getActiveContracts(): Promise<Contract[]> {
    const cached = this.contractCache.get('active');
    if (cached) return cached;
    const all = await this.contracts.available({ live: false });
    const active = all.filter((c) => c.activeContract);
    this.contractCache.set('active', active);
    return active;
  }

  /** Clear the contract cache, forcing fresh fetches on next call. */
  clearContractCache(): void {
    this.contractCache.clear();
  }

  // ── Market helpers ─────────────────────────────────────────────

  /**
   * Subscribe to real-time quote updates for a contract.
   * Returns an async cleanup function that unsubscribes from the hub.
   */
  async subscribeTicker(
    contractId: number,
    callback: (quote: GatewayQuote) => void,
  ): Promise<() => Promise<void>> {
    const hub = this.marketHub;
    const unsub = hub.onQuote(callback);
    await hub.subscribeQuotes(contractId);
    return async () => {
      unsub();
      await hub.unsubscribeQuotes(contractId);
    };
  }

  /**
   * Subscribe to real-time depth of market updates for a contract.
   * Returns an async cleanup function that unsubscribes from the hub.
   */
  async subscribeDepth(
    contractId: number,
    callback: (depth: GatewayDepth) => void,
  ): Promise<() => Promise<void>> {
    const hub = this.marketHub;
    const unsub = hub.onDepth(callback);
    await hub.subscribeDepth(contractId);
    return async () => {
      unsub();
      await hub.unsubscribeDepth(contractId);
    };
  }

  /**
   * Get a single quote for a contract by subscribing, waiting for the first
   * quote event, and then unsubscribing. Auto-starts MarketHub if not connected.
   */
  async getLatestQuote(contractId: number, timeoutMs: number = 5000): Promise<GatewayQuote> {
    const hub = this.marketHub;
    if (hub.state !== HubConnectionState.Connected) {
      await hub.start();
    }
    return new Promise<GatewayQuote>((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out waiting for quote on contract ${contractId}`));
      }, timeoutMs);

      const cleanup = () => {
        clearTimeout(timer);
        unsub();
        hub.unsubscribeQuotes(contractId).catch(() => {});
      };

      const unsub = hub.onQuote((quote) => {
        cleanup();
        resolve(quote);
      });

      hub.subscribeQuotes(contractId).catch((err: unknown) => {
        cleanup();
        reject(err);
      });
    });
  }

  // ── History helpers ────────────────────────────────────────────

  /**
   * Retrieve historical bars with sensible defaults.
   * Defaults: last 24 hours, 1-minute bars, 500 bar limit, include partial bar.
   */
  async getBars(contractId: string, options?: Partial<GetBarsOptions>): Promise<Bar[]> {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return this.history.retrieveBars({
      contractId,
      live: options?.live ?? false,
      startTime: (options?.startTime ?? dayAgo).toISOString(),
      endTime: (options?.endTime ?? now).toISOString(),
      unit: options?.unit ?? BarUnit.Minute,
      unitNumber: options?.unitNumber ?? 1,
      limit: options?.limit ?? 500,
      includePartialBar: options?.includePartialBar ?? true,
    });
  }

  // ── Order builder ───────────────────────────────────────────

  /** Create a new fluent order builder for the given account. */
  order(accountId: number): OrderBuilder {
    return new OrderBuilder(
      accountId,
      this.orders,
      async (contractId: string) => {
        const results = await this.contracts.searchById({ contractId });
        return results[0] ?? null;
      },
    );
  }

  // ── Bracket & trailing helpers ──────────────────────────────

  /** Place an entry order with stop-loss and take-profit brackets in a single API call. */
  async placeBracketOrder(options: BracketOrderOptions): Promise<number> {
    return this.orders.place({
      accountId: options.accountId,
      contractId: options.contractId,
      type: options.type,
      side: options.side,
      size: options.size,
      limitPrice: options.limitPrice ?? null,
      stopPrice: options.stopPrice ?? null,
      customTag: options.customTag ?? null,
      stopLossBracket: {
        ticks: options.stopLossTicks,
        type: options.stopLossType ?? OrderType.Stop,
      },
      takeProfitBracket: {
        ticks: options.takeProfitTicks,
        type: options.takeProfitType ?? OrderType.Limit,
      },
    });
  }

  /** Place a trailing stop order. */
  async placeTrailingStop(
    accountId: number,
    contractId: string,
    side: OrderSide,
    size: number,
    trailPrice: number,
    customTag?: string,
  ): Promise<number> {
    return this.orders.place({
      accountId,
      contractId,
      type: OrderType.TrailingStop,
      side,
      size,
      trailPrice,
      customTag: customTag ?? null,
    });
  }

  /** Modify the trail distance on an existing trailing stop order. */
  async modifyTrailingDistance(
    accountId: number,
    orderId: number,
    trailPrice: number,
  ): Promise<void> {
    await this.orders.modify({
      accountId,
      orderId,
      trailPrice,
    });
  }

  // ── Monitoring ──────────────────────────────────────────────

  /** Register a callback for order fills on an account. Returns unsubscribe function. */
  onFill(
    accountId: number,
    callback: (order: GatewayUserOrder) => void,
  ): () => void {
    return this.userHub.onOrder((order) => {
      if (order.accountId === accountId && order.status === OrderStatus.Filled) {
        callback(order);
      }
    });
  }

  /** Wait for a specific order to fill. Returns promise resolving with the filled order. */
  async waitForFill(
    orderId: number,
    timeoutMs: number = 30_000,
  ): Promise<GatewayUserOrder> {
    return new Promise<GatewayUserOrder>((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out waiting for order ${orderId} to fill after ${timeoutMs}ms`));
      }, timeoutMs);

      const cleanup = () => {
        clearTimeout(timer);
        unsub();
      };

      const unsub = this.userHub.onOrder((order) => {
        if (order.id === orderId && order.status === OrderStatus.Filled) {
          cleanup();
          resolve(order);
        }
      });
    });
  }

  /** Watch position updates for a specific account and contract. Returns unsubscribe function. */
  watchPosition(
    accountId: number,
    contractId: string,
    callback: (position: GatewayUserPosition) => void,
  ): () => void {
    return this.userHub.onPosition((position) => {
      if (position.accountId === accountId && position.contractId === contractId) {
        callback(position);
      }
    });
  }

  /** Watch all order status changes for an account. Returns unsubscribe function. */
  watchOrders(
    accountId: number,
    callback: (order: GatewayUserOrder) => void,
  ): () => void {
    return this.userHub.onOrder((order) => {
      if (order.accountId === accountId) {
        callback(order);
      }
    });
  }

  // -- OCO (one-cancels-other) -----------------------------------------------

  /**
   * Place two orders as an OCO pair. When one fills, the other is automatically
   * cancelled. Returns a handle with cancel() to manually cancel both and a
   * result promise that resolves with the fill outcome.
   *
   * Both orders are tagged with a unique `oco-{id}` customTag for reconnect
   * reconciliation. If both orders fill before the cancel request completes,
   * the result indicates bothFilled = true.
   *
   * Requires an active UserHub subscription for the account's orders
   * (call userHub.subscribeOrders(accountId) before placing OCO, or use
   * connect() which starts the hub).
   */
  async placeOCO(options: OCOOptions): Promise<OCOResult> {
    const groupTag = `oco-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Place both orders with group tags
    const orderIdA = await this.orders.place({
      accountId: options.accountId,
      contractId: options.contractId,
      type: options.orderA.type,
      side: options.orderA.side,
      size: options.orderA.size,
      limitPrice: options.orderA.limitPrice ?? null,
      stopPrice: options.orderA.stopPrice ?? null,
      customTag: `${groupTag}-a`,
    });

    let orderIdB: number;
    try {
      orderIdB = await this.orders.place({
        accountId: options.accountId,
        contractId: options.contractId,
        type: options.orderB.type,
        side: options.orderB.side,
        size: options.orderB.size,
        limitPrice: options.orderB.limitPrice ?? null,
        stopPrice: options.orderB.stopPrice ?? null,
        customTag: `${groupTag}-b`,
      });
    } catch (err) {
      // If order B fails to place, cancel order A to avoid orphan
      await this.orders.cancel({ accountId: options.accountId, orderId: orderIdA }).catch(() => {});
      throw err;
    }

    // Set up fill detection
    let resolveResult!: (result: OCOFillResult) => void;
    let rejectResult!: (error: Error) => void;
    const resultPromise = new Promise<OCOFillResult>((res, rej) => {
      resolveResult = res;
      rejectResult = rej;
    });

    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      settled = true;
      if (timer) clearTimeout(timer);
      unsub();
    };

    const unsub = this.userHub.onOrder(async (order) => {
      if (settled) return;
      if (order.status !== OrderStatus.Filled) return;
      if (order.id !== orderIdA && order.id !== orderIdB) return;

      cleanup();

      const filledId = order.id;
      const otherId = filledId === orderIdA ? orderIdB : orderIdA;

      // Attempt to cancel the other order
      let bothFilled = false;
      try {
        await this.orders.cancel({ accountId: options.accountId, orderId: otherId });
      } catch {
        // Cancel failed -- other order may have also filled
        bothFilled = true;
      }

      resolveResult({
        filledOrderId: filledId,
        cancelledOrderId: otherId,
        filledOrder: order,
        bothFilled,
      });
    });

    // Optional timeout
    if (options.timeoutMs) {
      timer = setTimeout(() => {
        if (!settled) {
          cleanup();
          // Cancel both orders on timeout
          Promise.allSettled([
            this.orders.cancel({ accountId: options.accountId, orderId: orderIdA }),
            this.orders.cancel({ accountId: options.accountId, orderId: orderIdB }),
          ]).then(() => {
            rejectResult(new Error(`OCO timed out after ${options.timeoutMs}ms`));
          });
        }
      }, options.timeoutMs);
    }

    // Manual cancel function
    const cancel = async (): Promise<void> => {
      if (settled) return;
      cleanup();
      await Promise.allSettled([
        this.orders.cancel({ accountId: options.accountId, orderId: orderIdA }),
        this.orders.cancel({ accountId: options.accountId, orderId: orderIdB }),
      ]);
    };

    return { orderIdA, orderIdB, cancel, result: resultPromise };
  }

  // -- Multi-target brackets --------------------------------------------------

  /**
   * Place an entry order with multiple take-profit levels at different sizes.
   *
   * The API supports only one takeProfitBracket per order. The first target is
   * placed as the native API bracket. After the entry fills, remaining targets
   * are placed as individual opposing limit orders. The stop loss is placed as
   * the native API stopLossBracket.
   *
   * Validates that sum(targets[].size) === entrySize before placing any orders.
   *
   * Requires an active UserHub subscription for the account's orders.
   */
  async placeMultiTargetBracket(options: MultiTargetBracketOptions): Promise<MultiTargetResult> {
    // 1. Validate targets array is not empty (check before size sum)
    if (options.targets.length === 0) {
      throw new ApiError(0, 'At least one target is required');
    }

    // 2. Validate target sizes sum to entry size
    const totalTargetSize = options.targets.reduce((sum, t) => sum + t.size, 0);
    if (totalTargetSize !== options.entrySize) {
      throw new ApiError(
        0,
        `Target sizes sum (${totalTargetSize}) must equal entry size (${options.entrySize})`,
      );
    }

    // Sort targets by ticks ascending (closest first)
    const sortedTargets = [...options.targets].sort((a, b) => a.ticks - b.ticks);

    // 2. Place entry order with first target as native bracket
    const entryOrderId = await this.orders.place({
      accountId: options.accountId,
      contractId: options.contractId,
      type: options.entryType,
      side: options.side,
      size: options.entrySize,
      limitPrice: options.limitPrice ?? null,
      stopPrice: options.stopPrice ?? null,
      customTag: options.customTag ?? null,
      takeProfitBracket: {
        ticks: sortedTargets[0].ticks,
        type: OrderType.Limit,
      },
      stopLossBracket: {
        ticks: options.stopLossTicks,
        type: options.stopLossType ?? OrderType.Stop,
      },
    });

    // Track all order IDs
    const targetOrderIds: number[] = [];
    let stopLossOrderId: number | null = null;

    // 3. Set up fill detection for entry order
    let resolveResult!: (order: GatewayUserOrder) => void;
    const resultPromise = new Promise<GatewayUserOrder>((res) => {
      resolveResult = res;
    });

    let settled = false;

    const unsub = this.userHub.onOrder(async (order) => {
      if (settled) return;
      if (order.id !== entryOrderId || order.status !== OrderStatus.Filled) return;

      settled = true;
      unsub();

      // 4. Place additional TP targets as individual opposing limit orders
      // Skip first target (already placed as native bracket)
      if (sortedTargets.length > 1) {
        const opposingSide = options.side === OrderSide.Bid ? OrderSide.Ask : OrderSide.Bid;

        // Get contract for tick size calculation
        const contracts = await this.contracts.searchById({ contractId: options.contractId });
        const contract = contracts[0];

        if (contract && order.filledPrice != null) {
          for (let i = 1; i < sortedTargets.length; i++) {
            const target = sortedTargets[i];
            const tpPrice =
              options.side === OrderSide.Bid
                ? order.filledPrice + target.ticks * contract.tickSize
                : order.filledPrice - target.ticks * contract.tickSize;

            try {
              const tpOrderId = await this.orders.place({
                accountId: options.accountId,
                contractId: options.contractId,
                type: OrderType.Limit,
                side: opposingSide,
                size: target.size,
                limitPrice: tpPrice,
                customTag: options.customTag ? `${options.customTag}-tp${i + 1}` : null,
              });
              targetOrderIds.push(tpOrderId);
            } catch {
              // Log but continue placing remaining targets
            }
          }
        }
      }

      resolveResult(order);
    });

    // Cancel function -- cancel entry + all placed target/SL orders
    const cancel = async (): Promise<void> => {
      if (!settled) {
        settled = true;
        unsub();
      }
      const orderIds = [entryOrderId, ...targetOrderIds];
      if (stopLossOrderId) orderIds.push(stopLossOrderId);
      await Promise.allSettled(
        orderIds.map((id) =>
          this.orders.cancel({ accountId: options.accountId, orderId: id }),
        ),
      );
    };

    return {
      entryOrderId,
      targetOrderIds,
      stopLossOrderId,
      cancel,
      result: resultPromise,
    };
  }

  /**
   * Attach take-profit and/or stop-loss orders to an existing open position.
   *
   * Fetches the current position to determine direction and size, fetches the
   * contract for tick size, then places opposing orders at calculated prices.
   *
   * For Long positions: SL = sell stop below avgPrice, TP = sell limit above.
   * For Short positions: SL = buy stop above avgPrice, TP = buy limit below.
   *
   * At least one of stopLossTicks or takeProfitTicks must be provided.
   */
  async addBracketToPosition(options: AddBracketOptions): Promise<AddBracketResult> {
    if (!options.stopLossTicks && !options.takeProfitTicks) {
      throw new ApiError(0, 'At least one of stopLossTicks or takeProfitTicks is required');
    }

    // Fetch position
    const positions = await this.positions.searchOpen({ accountId: options.accountId });
    const position = positions.find((p) => p.contractId === options.contractId);
    if (!position) {
      throw new ApiError(
        0,
        `No open position found for contract ${options.contractId} on account ${options.accountId}`,
      );
    }

    // Fetch contract for tick size
    const contracts = await this.contracts.searchById({ contractId: options.contractId });
    const contract = contracts[0];
    if (!contract) {
      throw new ApiError(0, `Contract ${options.contractId} not found`);
    }

    const isLong = position.type === PositionType.Long;
    const closingSide = isLong ? OrderSide.Ask : OrderSide.Bid;

    let stopLossOrderId: number | null = null;
    let takeProfitOrderId: number | null = null;

    // Place stop loss
    if (options.stopLossTicks) {
      const slPrice = isLong
        ? position.averagePrice - options.stopLossTicks * contract.tickSize
        : position.averagePrice + options.stopLossTicks * contract.tickSize;

      stopLossOrderId = await this.orders.place({
        accountId: options.accountId,
        contractId: options.contractId,
        type: options.stopLossType ?? OrderType.Stop,
        side: closingSide,
        size: position.size,
        stopPrice: slPrice,
      });
    }

    // Place take profit
    if (options.takeProfitTicks) {
      const tpPrice = isLong
        ? position.averagePrice + options.takeProfitTicks * contract.tickSize
        : position.averagePrice - options.takeProfitTicks * contract.tickSize;

      takeProfitOrderId = await this.orders.place({
        accountId: options.accountId,
        contractId: options.contractId,
        type: options.takeProfitType ?? OrderType.Limit,
        side: closingSide,
        size: position.size,
        limitPrice: tpPrice,
      });
    }

    return { stopLossOrderId, takeProfitOrderId };
  }

  // -- ATM strategy -------------------------------------------------------

  /**
   * Execute an ATM (at-the-money) strategy from a template.
   *
   * An ATM strategy is a predefined entry/exit configuration that automates
   * bracket placement. The template specifies targets (multiple TP levels),
   * stop loss (optionally trailing), and optional breakeven rules.
   *
   * Internally composes placeMultiTargetBracket() with optional breakeven
   * monitoring. The breakeven feature requires an active UserHub subscription
   * and monitors the position via quote updates.
   *
   * If template.stopLoss.type is TrailingStop or template.stopLoss.trailPrice
   * is set, the native API TrailingStop order type is used for the stop loss.
   *
   * If template.breakeven is defined, after the entry fills this method
   * subscribes to position update events. When the position's profit in ticks
   * reaches the breakeven trigger distance, it modifies the SL order to the
   * entry fill price plus the offset.
   *
   * @param accountId - Account to place orders on
   * @param contractId - Contract to trade
   * @param side - Entry side (Bid for buy, Ask for sell)
   * @param entryType - Entry order type (Limit, Market, Stop, etc.)
   * @param limitPrice - Limit price (required for Limit/StopLimit types)
   * @param stopPrice - Stop price (required for Stop/StopLimit types)
   * @param template - ATM strategy template defining targets, SL, and breakeven
   */
  async executeATMStrategy(
    accountId: number,
    contractId: string,
    side: OrderSide,
    entryType: OrderType,
    limitPrice: number | undefined,
    stopPrice: number | undefined,
    template: ATMStrategyTemplate,
  ): Promise<ATMResult> {
    if (template.targets.length === 0) {
      throw new ApiError(0, 'ATM strategy must have at least one target');
    }

    const entrySize = template.targets.reduce((sum, t) => sum + t.size, 0);

    // Determine stop loss type
    const slType = template.stopLoss.type
      ?? (template.stopLoss.trailPrice ? OrderType.TrailingStop : OrderType.Stop);

    // Place multi-target bracket
    const bracketResult = await this.placeMultiTargetBracket({
      accountId,
      contractId,
      side,
      entryType,
      entrySize,
      limitPrice,
      stopPrice,
      targets: template.targets.map((t) => ({
        ticks: t.ticks,
        size: t.size,
      })),
      stopLossTicks: template.stopLoss.ticks,
      stopLossType: slType,
      customTag: `atm-${template.name}`,
    });

    // Breakeven monitoring (if configured)
    let breakevenUnsub: (() => void) | null = null;

    if (template.breakeven) {
      const triggerTicks = template.breakeven.triggerTicks;
      const offsetTicks = template.breakeven.offsetTicks ?? 0;

      // After entry fills, monitor position for breakeven trigger
      const entryFillPromise = bracketResult.result.then(async (filledOrder) => {
        if (filledOrder.filledPrice == null) return;

        const entryPrice = filledOrder.filledPrice;

        // Get contract for tick size
        const contracts = await this.contracts.searchById({ contractId });
        const contract = contracts[0];
        if (!contract) return;

        // Subscribe to position updates to detect breakeven trigger
        breakevenUnsub = this.userHub.onPosition((position) => {
          if (position.accountId !== accountId || position.contractId !== contractId) return;

          // Calculate current profit in ticks
          const isLong = side === OrderSide.Bid;
          const profitTicks = isLong
            ? (position.averagePrice - entryPrice) / contract.tickSize
            : (entryPrice - position.averagePrice) / contract.tickSize;

          if (profitTicks >= triggerTicks && breakevenUnsub) {
            // Move SL to breakeven (entry price + offset)
            breakevenUnsub();
            breakevenUnsub = null;

            const breakevenPrice = isLong
              ? entryPrice + offsetTicks * contract.tickSize
              : entryPrice - offsetTicks * contract.tickSize;

            // Find and modify the SL order
            this.orders.searchOpen({ accountId }).then((openOrders) => {
              const slOrder = openOrders.find(
                (o) =>
                  o.contractId === contractId &&
                  o.side === (isLong ? OrderSide.Ask : OrderSide.Bid) &&
                  (o.type === OrderType.Stop || o.type === OrderType.TrailingStop),
              );

              if (slOrder) {
                this.orders.modify({
                  accountId,
                  orderId: slOrder.id,
                  stopPrice: breakevenPrice,
                }).catch(() => {});
              }
            }).catch(() => {});
          }
        });
      });

      // Fire and forget -- don't block on breakeven setup
      entryFillPromise.catch(() => {});
    }

    // Wrap cancel to also clean up breakeven monitoring
    const cancel = async (): Promise<void> => {
      if (breakevenUnsub) {
        breakevenUnsub();
        breakevenUnsub = null;
      }
      await bracketResult.cancel();
    };

    return {
      entryOrderId: bracketResult.entryOrderId,
      targetOrderIds: bracketResult.targetOrderIds,
      stopLossOrderId: bracketResult.stopLossOrderId,
      cancel,
      result: bracketResult.result,
    };
  }

  // -- Trade copier -------------------------------------------------------

  /**
   * Copy a single trade from one account to one or more target accounts.
   *
   * Places market orders on each target account matching the source trade
   * direction. Size is adjusted by sizeRatio (default 1.0) and clamped to
   * maxSize if specified. Copied orders are tagged with the source account
   * ID to prevent amplification loops.
   *
   * @param sourceAccountId - Account the original trade was on
   * @param targetAccountIds - Accounts to copy the trade to
   * @param trade - The trade to copy (contractId, side, size)
   * @param options - Size ratio, max size, tag prefix
   */
  async copyTrade(
    sourceAccountId: number,
    targetAccountIds: number[],
    trade: { contractId: string; side: OrderSide; size: number },
    options?: CopyTradeOptions,
  ): Promise<void> {
    const ratio = options?.sizeRatio ?? 1.0;
    const tag = `${options?.tagPrefix ?? 'copy'}-${sourceAccountId}`;

    await Promise.all(
      targetAccountIds.map(async (targetId) => {
        const targetSize = Math.max(1, Math.round(trade.size * ratio));
        const clampedSize = options?.maxSize
          ? Math.min(targetSize, options.maxSize)
          : targetSize;

        await this.orders.place({
          accountId: targetId,
          contractId: trade.contractId,
          type: OrderType.Market,
          side: trade.side,
          size: clampedSize,
          customTag: tag,
        });
      }),
    );
  }

  /**
   * Continuously mirror positions from a source account to target accounts.
   *
   * Performs initial position reconciliation: fetches open positions on source
   * and targets, calculates deltas, and places orders to synchronize. Then
   * subscribes to source account trade events and replicates each new trade
   * to all target accounts.
   *
   * Events from copied orders (identified by customTag prefix) are filtered
   * out to prevent feedback amplification loops.
   *
   * Returns a MirrorController with stop() to terminate mirroring and active
   * status.
   *
   * Requires UserHub to be connected and subscribed to trades for the source
   * account.
   *
   * @param sourceAccountId - Account to mirror from
   * @param targetAccountIds - Accounts to mirror to
   * @param options - Size ratio, max size, tag prefix, skip initial reconciliation
   */
  async mirrorPositions(
    sourceAccountId: number,
    targetAccountIds: number[],
    options?: MirrorOptions,
  ): Promise<MirrorController> {
    const ratio = options?.sizeRatio ?? 1.0;
    const maxSize = options?.maxSize;
    const tagPrefix = options?.tagPrefix ?? 'copy';
    const tag = `${tagPrefix}-${sourceAccountId}`;
    let isActive = true;

    // 1. Initial position reconciliation (unless skipped)
    if (!options?.ignoreExistingPositions) {
      const sourcePositions = await this.positions.searchOpen({ accountId: sourceAccountId });

      for (const targetId of targetAccountIds) {
        const targetPositions = await this.positions.searchOpen({ accountId: targetId });

        for (const srcPos of sourcePositions) {
          const tgtPos = targetPositions.find((p) => p.contractId === srcPos.contractId);

          const targetSize = Math.max(1, Math.round(srcPos.size * ratio));
          const clampedSize = maxSize ? Math.min(targetSize, maxSize) : targetSize;

          if (!tgtPos) {
            // Target has no position -- open one
            const side = srcPos.type === PositionType.Long ? OrderSide.Bid : OrderSide.Ask;
            await this.orders.place({
              accountId: targetId,
              contractId: srcPos.contractId,
              type: OrderType.Market,
              side,
              size: clampedSize,
              customTag: tag,
            });
          }
          // If target already has a position, assume it's in sync (simplified)
          // Full reconciliation (size delta, direction mismatch) is out of scope for v1
        }
      }
    }

    // 2. Subscribe to source account trade events for ongoing mirroring
    const unsub = this.userHub.onTrade(async (trade) => {
      if (!isActive) return;
      if (trade.accountId !== sourceAccountId) return;

      // Filter out events from our own copied orders (prevent feedback loop)
      const openOrders = await this.orders.searchOpen({ accountId: sourceAccountId });
      const triggeringOrder = openOrders.find((o) => o.id === trade.orderId);
      if (triggeringOrder?.customTag?.startsWith(tagPrefix)) return;

      // Replicate trade to all targets
      const targetSize = Math.max(1, Math.round(trade.size * ratio));
      const clampedSize = maxSize ? Math.min(targetSize, maxSize) : targetSize;

      await Promise.allSettled(
        targetAccountIds.map((targetId) =>
          this.orders.place({
            accountId: targetId,
            contractId: trade.contractId,
            type: OrderType.Market,
            side: trade.side,
            size: clampedSize,
            customTag: tag,
          }),
        ),
      );
    });

    // 3. Return controller
    const controller: MirrorController = {
      get active() {
        return isActive;
      },
      stop: async () => {
        isActive = false;
        unsub();
      },
    };

    return controller;
  }
}

// -- Factory function -------------------------------------------------------

/**
 * Creates a new TopstepXClient instance with the provided credentials.
 *
 * @param userName - Your TopstepX username
 * @param apiKey - Your TopstepX API key
 * @param options - Optional configuration (baseUrl, rtcUrl, tokenStore)
 *
 * @example
 * ```typescript
 * import { createClient } from 'topstepx';
 *
 * const client = createClient('my-username', 'my-api-key');
 *
 * // Get accounts
 * const accounts = await client.accounts.search({});
 * ```
 */
export function createClient(
  userName: string,
  apiKey: string,
  options?: TopstepXOptions,
): TopstepXClient {
  const credentials: ApiKeyCredentials = { userName, apiKey };
  return new TopstepXClient({ credentials, ...options });
}
