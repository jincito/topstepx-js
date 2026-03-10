import type { ApiResponse } from './common.js';
import type { BarUnit, DomType, TradeLogType } from './enums.js';

/** Real-time quote from Market Hub */
export interface GatewayQuote {
  symbol: string;
  symbolName: string;
  lastPrice: number;
  bestBid: number;
  bestAsk: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  lastUpdated: string;
  timestamp: string;
}

/** Real-time market trade from Market Hub */
export interface GatewayTrade {
  symbolId: string;
  price: number;
  timestamp: string;
  type: TradeLogType;
  volume: number;
}

/** Real-time depth of market update from Market Hub */
export interface GatewayDepth {
  timestamp: string;
  type: DomType;
  price: number;
  volume: number;
  currentVolume: number;
}

/** Historical bar (OHLCV) */
export interface Bar {
  /** Timestamp */
  t: string;
  /** Open */
  o: number;
  /** High */
  h: number;
  /** Low */
  l: number;
  /** Close */
  c: number;
  /** Volume */
  v: number;
}

/** Request body for POST /api/History/retrieveBars */
export interface RetrieveBarsRequest {
  contractId: string;
  live: boolean;
  startTime: string;
  endTime: string;
  unit: BarUnit;
  unitNumber: number;
  limit: number;
  includePartialBar: boolean;
}

/** Response from POST /api/History/retrieveBars */
export interface RetrieveBarsResponse extends ApiResponse {
  bars: Bar[];
}
