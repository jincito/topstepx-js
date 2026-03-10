import type { AuthManager } from '../auth/auth-manager.js';
import type {
  GatewayUserAccount,
  GatewayUserOrder,
  GatewayUserPosition,
  GatewayUserTrade,
} from '../types/events.js';
import { BaseHub } from './base-hub.js';

/**
 * Typed hub for User Hub real-time events.
 *
 * Provides typed subscribe/unsubscribe methods for accounts, orders,
 * positions, and trades, plus typed event handlers that return
 * unsubscribe functions.
 */
export class UserHub extends BaseHub {
  constructor({ authManager, url = 'https://rtc.topstepx.com/hubs/user' }: { authManager: AuthManager; url?: string }) {
    super({ url, authManager });
  }

  // ── Event handlers ──────────────────────────────────────────────

  /** Register handler for account updates. Returns an unsubscribe function. */
  onAccount(handler: (account: GatewayUserAccount) => void): () => void {
    return this.on('GatewayUserAccount', handler);
  }

  /** Register handler for order updates. Returns an unsubscribe function. */
  onOrder(handler: (order: GatewayUserOrder) => void): () => void {
    return this.on('GatewayUserOrder', handler);
  }

  /** Register handler for position updates. Returns an unsubscribe function. */
  onPosition(handler: (position: GatewayUserPosition) => void): () => void {
    return this.on('GatewayUserPosition', handler);
  }

  /** Register handler for trade updates. Returns an unsubscribe function. */
  onTrade(handler: (trade: GatewayUserTrade) => void): () => void {
    return this.on('GatewayUserTrade', handler);
  }

  // ── Subscribe / Unsubscribe ─────────────────────────────────────

  /** Subscribe to account updates. */
  async subscribeAccounts(): Promise<void> {
    await this.subscribe('SubscribeAccounts');
  }

  /** Unsubscribe from account updates. */
  async unsubscribeAccounts(): Promise<void> {
    await this.unsubscribe('UnsubscribeAccounts');
  }

  /** Subscribe to order updates for a specific account. */
  async subscribeOrders(accountId: number): Promise<void> {
    await this.subscribe('SubscribeOrders', accountId);
  }

  /** Unsubscribe from order updates for a specific account. */
  async unsubscribeOrders(accountId: number): Promise<void> {
    await this.unsubscribe('UnsubscribeOrders', accountId);
  }

  /** Subscribe to position updates for a specific account. */
  async subscribePositions(accountId: number): Promise<void> {
    await this.subscribe('SubscribePositions', accountId);
  }

  /** Unsubscribe from position updates for a specific account. */
  async unsubscribePositions(accountId: number): Promise<void> {
    await this.unsubscribe('UnsubscribePositions', accountId);
  }

  /** Subscribe to trade updates for a specific account. */
  async subscribeTrades(accountId: number): Promise<void> {
    await this.subscribe('SubscribeTrades', accountId);
  }

  /** Unsubscribe from trade updates for a specific account. */
  async unsubscribeTrades(accountId: number): Promise<void> {
    await this.unsubscribe('UnsubscribeTrades', accountId);
  }
}
