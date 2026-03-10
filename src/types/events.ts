import type { OrderSide, OrderType, OrderStatus, PositionType } from './enums.js';

/** Real-time account update from User Hub */
export interface GatewayUserAccount {
  id: number;
  name: string;
  balance: number;
  canTrade: boolean;
  isVisible: boolean;
  simulated: boolean;
}

/** Real-time order update from User Hub */
export interface GatewayUserOrder {
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

/** Real-time position update from User Hub */
export interface GatewayUserPosition {
  id: number;
  accountId: number;
  contractId: string;
  creationTimestamp: string;
  type: PositionType;
  size: number;
  averagePrice: number;
}

/** Real-time trade update from User Hub */
export interface GatewayUserTrade {
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
