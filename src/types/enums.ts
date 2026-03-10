/**
 * All enum values match TopstepX API numeric values exactly.
 * Source: docs/topstepx-api.md
 */

/** Order side -- 0 = Buy/Bid, 1 = Sell/Ask */
export enum OrderSide {
  /** Buy / Bid side */
  Bid = 0,
  /** Sell / Ask side */
  Ask = 1,
}

/** Order type -- matches API numeric values */
export enum OrderType {
  Unknown = 0,
  Limit = 1,
  Market = 2,
  StopLimit = 3,
  Stop = 4,
  TrailingStop = 5,
  JoinBid = 6,
  JoinAsk = 7,
}

/** Order status -- matches API numeric values */
export enum OrderStatus {
  None = 0,
  Open = 1,
  Filled = 2,
  Cancelled = 3,
  Expired = 4,
  Rejected = 5,
  Pending = 6,
}

/** Position type -- matches API numeric values */
export enum PositionType {
  Undefined = 0,
  Long = 1,
  Short = 2,
}

/** DOM (Depth of Market) entry type -- matches API numeric values */
export enum DomType {
  Unknown = 0,
  Ask = 1,
  Bid = 2,
  BestAsk = 3,
  BestBid = 4,
  Trade = 5,
  Reset = 6,
  Low = 7,
  High = 8,
  NewBestBid = 9,
  NewBestAsk = 10,
  Fill = 11,
}

/** Trade log type -- 0 = Buy, 1 = Sell */
export enum TradeLogType {
  Buy = 0,
  Sell = 1,
}

/** Bar time unit for historical data -- matches API numeric values (1-6) */
export enum BarUnit {
  Second = 1,
  Minute = 2,
  Hour = 3,
  Day = 4,
  Week = 5,
  Month = 6,
}
