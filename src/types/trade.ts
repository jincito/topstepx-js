import type { ApiResponse } from './common.js';
import type { OrderSide } from './enums.js';

/** Request body for POST /api/Trade/search */
export interface TradeSearchRequest {
  accountId: number;
  startTimestamp: string;
  endTimestamp?: string | null;
}

/** Trade entity as returned by the API */
export interface Trade {
  id: number;
  accountId: number;
  contractId: string;
  creationTimestamp: string;
  price: number;
  /** Null indicates a half-turn trade (opening trade without paired close) */
  profitAndLoss: number | null;
  fees: number;
  side: OrderSide;
  size: number;
  voided: boolean;
  orderId: number;
}

/** Response from POST /api/Trade/search */
export interface TradeSearchResponse extends ApiResponse {
  trades: Trade[];
}
