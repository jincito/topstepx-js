import type { ApiResponse } from './common.js';

/** Request body for POST /api/Account/search */
export interface AccountSearchRequest {
  onlyActiveAccounts: boolean;
}

/** Account entity returned by the API */
export interface Account {
  id: number;
  name: string;
  balance: number;
  canTrade: boolean;
  isVisible: boolean;
}

/** Response from POST /api/Account/search */
export interface AccountSearchResponse extends ApiResponse {
  accounts: Account[];
}
