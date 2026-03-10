import type { Account } from './account.js';
import type { Position } from './position.js';
import type { Order } from './order.js';
import type { BarUnit, OrderSide, OrderType } from './enums.js';
import type { GatewayUserOrder } from './events.js';

/** Return type for getAccountSummary helper */
export interface AccountSummary {
  account: Account;
  positions: Position[];
  orders: Order[];
}

/** Options for getBars helper */
export interface GetBarsOptions {
  live: boolean;
  startTime: Date;
  endTime: Date;
  unit: BarUnit;
  unitNumber: number;
  limit: number;
  includePartialBar: boolean;
}

/** Options for placeBracketOrder helper */
export interface BracketOrderOptions {
  accountId: number;
  contractId: string;
  side: OrderSide;
  type: OrderType;
  size: number;
  limitPrice?: number;
  stopPrice?: number;
  stopLossTicks: number;
  takeProfitTicks: number;
  stopLossType?: OrderType;
  takeProfitType?: OrderType;
  customTag?: string;
}

// ── Phase 7: OCO types ────────────────────────────────────────────────────

/** Options for placeOCO -- two orders that cancel each other on fill */
export interface OCOOptions {
  accountId: number;
  contractId: string;
  orderA: OCOOrderLeg;
  orderB: OCOOrderLeg;
  timeoutMs?: number;
}

/** Single leg of an OCO pair */
export interface OCOOrderLeg {
  side: OrderSide;
  type: OrderType;
  size: number;
  limitPrice?: number;
  stopPrice?: number;
}

/** Handle returned by placeOCO -- allows cancellation and awaiting result */
export interface OCOResult {
  orderIdA: number;
  orderIdB: number;
  cancel: () => Promise<void>;
  result: Promise<OCOFillResult>;
}

/** Outcome of an OCO pair -- which filled, which was cancelled */
export interface OCOFillResult {
  filledOrderId: number;
  cancelledOrderId: number;
  filledOrder: GatewayUserOrder;
  bothFilled: boolean;
}

// ── Phase 7: Multi-target bracket types ───────────────────────────────────

/** Options for placeMultiTargetBracket -- entry with multiple TP levels */
export interface MultiTargetBracketOptions {
  accountId: number;
  contractId: string;
  side: OrderSide;
  entryType: OrderType;
  entrySize: number;
  limitPrice?: number;
  stopPrice?: number;
  targets: BracketTarget[];
  stopLossTicks: number;
  stopLossType?: OrderType;
  customTag?: string;
}

/** Single take-profit target in a multi-target bracket */
export interface BracketTarget {
  ticks: number;
  size: number;
}

/** Handle returned by placeMultiTargetBracket */
export interface MultiTargetResult {
  entryOrderId: number;
  targetOrderIds: number[];
  stopLossOrderId: number | null;
  cancel: () => Promise<void>;
  result: Promise<GatewayUserOrder>;
}

// ── Phase 7: Add bracket to position types ────────────────────────────────

/** Options for addBracketToPosition -- attach TP/SL to an existing position */
export interface AddBracketOptions {
  accountId: number;
  contractId: string;
  stopLossTicks?: number;
  takeProfitTicks?: number;
  stopLossType?: OrderType;
  takeProfitType?: OrderType;
}

/** Result from addBracketToPosition */
export interface AddBracketResult {
  stopLossOrderId: number | null;
  takeProfitOrderId: number | null;
}

// ── Phase 7: ATM strategy types ───────────────────────────────────────────

/** ATM strategy template -- a predefined entry/exit configuration */
export interface ATMStrategyTemplate {
  name: string;
  targets: ATMTarget[];
  stopLoss: ATMStopLoss;
  breakeven?: ATMBreakeven;
}

/** Single target in an ATM strategy */
export interface ATMTarget {
  ticks: number;
  size: number;
  type?: OrderType;
}

/** Stop loss configuration in an ATM strategy */
export interface ATMStopLoss {
  ticks: number;
  type?: OrderType;
  trailPrice?: number;
}

/** Breakeven configuration -- move SL to entry after trigger profit */
export interface ATMBreakeven {
  triggerTicks: number;
  offsetTicks?: number;
}

/** Handle returned by executeATMStrategy */
export interface ATMResult {
  entryOrderId: number;
  targetOrderIds: number[];
  stopLossOrderId: number | null;
  cancel: () => Promise<void>;
  result: Promise<GatewayUserOrder>;
}

// ── Phase 7: Trade copier types ───────────────────────────────────────────

/** Options for copyTrade */
export interface CopyTradeOptions {
  sizeRatio?: number;
  maxSize?: number;
  tagPrefix?: string;
}

/** Options for mirrorPositions */
export interface MirrorOptions {
  sizeRatio?: number;
  maxSize?: number;
  tagPrefix?: string;
  ignoreExistingPositions?: boolean;
}

/** Controller returned by mirrorPositions for stopping mirroring */
export interface MirrorController {
  stop: () => Promise<void>;
  readonly active: boolean;
}
