import type { AuthManager } from '../auth/auth-manager.js';
import type { GatewayQuote, GatewayTrade, GatewayDepth } from '../types/market.js';
import { BaseHub } from './base-hub.js';

/**
 * Typed hub for Market Hub real-time events.
 *
 * Provides typed subscribe/unsubscribe methods for quotes, trades,
 * and depth per contractId, plus typed event handlers that return
 * unsubscribe functions.
 */
export class MarketHub extends BaseHub {
  constructor({ authManager, url = 'https://rtc.topstepx.com/hubs/market' }: { authManager: AuthManager; url?: string }) {
    super({ url, authManager });
  }

  // ── Event handlers ──────────────────────────────────────────────

  /** Register handler for quote updates. Returns an unsubscribe function. */
  onQuote(handler: (quote: GatewayQuote) => void): () => void {
    return this.on('GatewayQuote', handler);
  }

  /** Register handler for market trade updates. Returns an unsubscribe function. */
  onTrade(handler: (trade: GatewayTrade) => void): () => void {
    return this.on('GatewayTrade', handler);
  }

  /** Register handler for depth of market updates. Returns an unsubscribe function. */
  onDepth(handler: (depth: GatewayDepth) => void): () => void {
    return this.on('GatewayDepth', handler);
  }

  // ── Subscribe / Unsubscribe ─────────────────────────────────────

  /** Subscribe to quote updates for a specific contract. */
  async subscribeQuotes(contractId: number): Promise<void> {
    await this.subscribe('SubscribeContractQuotes', contractId);
  }

  /** Unsubscribe from quote updates for a specific contract. */
  async unsubscribeQuotes(contractId: number): Promise<void> {
    await this.unsubscribe('UnsubscribeContractQuotes', contractId);
  }

  /** Subscribe to trade updates for a specific contract. */
  async subscribeTrades(contractId: number): Promise<void> {
    await this.subscribe('SubscribeContractTrades', contractId);
  }

  /** Unsubscribe from trade updates for a specific contract. */
  async unsubscribeTrades(contractId: number): Promise<void> {
    await this.unsubscribe('UnsubscribeContractTrades', contractId);
  }

  /** Subscribe to depth of market updates for a specific contract. */
  async subscribeDepth(contractId: number): Promise<void> {
    await this.subscribe('SubscribeContractMarketDepth', contractId);
  }

  /** Unsubscribe from depth of market updates for a specific contract. */
  async unsubscribeDepth(contractId: number): Promise<void> {
    await this.unsubscribe('UnsubscribeContractMarketDepth', contractId);
  }
}
