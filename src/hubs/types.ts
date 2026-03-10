import type { HubConnectionState } from '@microsoft/signalr';
import type { AuthManager } from '../auth/auth-manager.js';
import type {
  GatewayUserAccount,
  GatewayUserOrder,
  GatewayUserPosition,
  GatewayUserTrade,
} from '../types/events.js';
import type { GatewayQuote, GatewayTrade, GatewayDepth } from '../types/market.js';

/** Options for constructing a hub connection */
export interface HubOptions {
  /** Full hub URL (e.g., https://rtc.topstepx.com/hubs/user) */
  url: string;
  /** AuthManager instance for token retrieval */
  authManager: AuthManager;
}

/** Typed event map for UserHub events */
export interface UserHubEvents {
  GatewayUserAccount: (account: GatewayUserAccount) => void;
  GatewayUserOrder: (order: GatewayUserOrder) => void;
  GatewayUserPosition: (position: GatewayUserPosition) => void;
  GatewayUserTrade: (trade: GatewayUserTrade) => void;
}

/** Typed event map for MarketHub events */
export interface MarketHubEvents {
  GatewayQuote: (quote: GatewayQuote) => void;
  GatewayTrade: (trade: GatewayTrade) => void;
  GatewayDepth: (depth: GatewayDepth) => void;
}

/** Re-export HubConnectionState as HubState for ergonomic API */
export type HubState = HubConnectionState;
