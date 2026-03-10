// Client facade (primary API surface)
export { TopstepXClient, createClient } from './client/index.js';
export { ContractCache } from './client/index.js';
export { OrderBuilder } from './client/index.js';

// Types and enums
export * from './types/index.js';

// Error classes
export { ApiError, AuthError, RateLimitError, ConnectionError } from './errors/index.js';

// Auth module
export { AuthManager, MemoryTokenStore } from './auth/index.js';
export type { TokenStore } from './auth/index.js';

// HTTP module
export { HttpClient, RateLimiter } from './http/index.js';

// API services
export {
  AccountService,
  ContractService,
  HistoryService,
  OrderService,
  PositionService,
  TradeService,
} from './api/index.js';

// Hub module
export { BaseHub, UserHub, MarketHub } from './hubs/index.js';
export type { HubOptions, UserHubEvents, MarketHubEvents, HubState } from './hubs/index.js';
