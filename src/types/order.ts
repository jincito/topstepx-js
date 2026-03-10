import type { ApiResponse } from './common.js';
import type { OrderSide, OrderType, OrderStatus } from './enums.js';

/** Bracket configuration for stop-loss or take-profit */
export interface BracketConfig {
  /** Number of ticks for the bracket offset */
  ticks: number;
  /** Order type for the bracket order */
  type: OrderType;
}

/** Request body for POST /api/Order/place */
export interface PlaceOrderRequest {
  accountId: number;
  contractId: string;
  type: OrderType;
  side: OrderSide;
  size: number;
  limitPrice?: number | null;
  stopPrice?: number | null;
  trailPrice?: number | null;
  customTag?: string | null;
  stopLossBracket?: BracketConfig | null;
  takeProfitBracket?: BracketConfig | null;
}

/** Response from POST /api/Order/place */
export interface PlaceOrderResponse extends ApiResponse {
  orderId: number;
}

/** Request body for POST /api/Order/search */
export interface OrderSearchRequest {
  accountId: number;
  startTimestamp: string;
  endTimestamp?: string | null;
}

/** Request body for POST /api/Order/searchOpen */
export interface OrderSearchOpenRequest {
  accountId: number;
}

/** Request body for POST /api/Order/cancel */
export interface CancelOrderRequest {
  accountId: number;
  orderId: number;
}

/** Request body for POST /api/Order/modify */
export interface ModifyOrderRequest {
  accountId: number;
  orderId: number;
  size?: number | null;
  limitPrice?: number | null;
  stopPrice?: number | null;
  trailPrice?: number | null;
}

/** Order entity as returned by search endpoints */
export interface Order {
  id: number;
  accountId: number;
  contractId: string;
  symbolId: string;
  creationTimestamp: string;
  updateTimestamp: string;
  status: OrderStatus;
  type: OrderType;
  side: OrderSide;
  size: number;
  limitPrice: number | null;
  stopPrice: number | null;
  fillVolume: number;
  filledPrice: number | null;
  customTag: string | null;
}

/** Response from POST /api/Order/search or /api/Order/searchOpen */
export interface OrderSearchResponse extends ApiResponse {
  orders: Order[];
}

/** Response from POST /api/Order/cancel */
export interface CancelOrderResponse extends ApiResponse {}

/** Response from POST /api/Order/modify */
export interface ModifyOrderResponse extends ApiResponse {}
