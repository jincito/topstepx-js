import type { ApiResponse } from './common.js';
import type { PositionType } from './enums.js';

/** Request body for POST /api/Position/searchOpen */
export interface PositionSearchOpenRequest {
  accountId: number;
}

/** Request body for POST /api/Position/closeContract */
export interface ClosePositionRequest {
  accountId: number;
  contractId: string;
}

/** Request body for POST /api/Position/partialCloseContract */
export interface PartialClosePositionRequest {
  accountId: number;
  contractId: string;
  size: number;
}

/** Position entity as returned by search endpoints */
export interface Position {
  id: number;
  accountId: number;
  contractId: string;
  creationTimestamp: string;
  type: PositionType;
  size: number;
  averagePrice: number;
}

/** Response from POST /api/Position/searchOpen */
export interface PositionSearchResponse extends ApiResponse {
  positions: Position[];
}

/** Response from POST /api/Position/closeContract */
export interface ClosePositionResponse extends ApiResponse {}

/** Response from POST /api/Position/partialCloseContract */
export interface PartialClosePositionResponse extends ApiResponse {}
