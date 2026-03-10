import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderService } from '../../src/api/order-service.js';
import type { HttpClient } from '../../src/http/http-client.js';
import { OrderType, OrderSide, OrderStatus } from '../../src/types/index.js';
import type {
  PlaceOrderResponse,
  OrderSearchResponse,
  CancelOrderResponse,
  ModifyOrderResponse,
} from '../../src/types/index.js';

function createMockHttp() {
  return { post: vi.fn() } as unknown as HttpClient & { post: ReturnType<typeof vi.fn> };
}

describe('OrderService', () => {
  let http: ReturnType<typeof createMockHttp>;
  let service: OrderService;

  beforeEach(() => {
    http = createMockHttp();
    service = new OrderService(http);
  });

  describe('place', () => {
    it('calls /api/Order/place and returns orderId', async () => {
      const mockResponse: PlaceOrderResponse = {
        success: true,
        errorCode: 0,
        errorMessage: null,
        orderId: 9056,
      };
      http.post.mockResolvedValue(mockResponse);

      const request = {
        accountId: 1,
        contractId: 'CON.F.US.ENQ.U25',
        type: OrderType.Market,
        side: OrderSide.Bid,
        size: 1,
      };
      const result = await service.place(request);

      expect(http.post).toHaveBeenCalledWith('/api/Order/place', request);
      expect(result).toBe(9056);
    });
  });

  describe('search', () => {
    it('calls /api/Order/search and returns orders array', async () => {
      const mockResponse: OrderSearchResponse = {
        success: true,
        errorCode: 0,
        errorMessage: null,
        orders: [
          {
            id: 1,
            accountId: 1,
            contractId: 'CON.F.US.ENQ.U25',
            symbolId: 'NQ',
            creationTimestamp: '2025-01-15T10:00:00Z',
            updateTimestamp: '2025-01-15T10:00:01Z',
            status: OrderStatus.Filled,
            type: OrderType.Market,
            side: OrderSide.Bid,
            size: 1,
            limitPrice: null,
            stopPrice: null,
            fillVolume: 1,
            filledPrice: 4500.25,
            customTag: null,
          },
        ],
      };
      http.post.mockResolvedValue(mockResponse);

      const request = { accountId: 1, startTimestamp: '2025-01-01T00:00:00Z' };
      const result = await service.search(request);

      expect(http.post).toHaveBeenCalledWith('/api/Order/search', request);
      expect(result).toEqual(mockResponse.orders);
    });
  });

  describe('searchOpen', () => {
    it('calls /api/Order/searchOpen and returns orders array', async () => {
      const mockResponse: OrderSearchResponse = {
        success: true,
        errorCode: 0,
        errorMessage: null,
        orders: [
          {
            id: 2,
            accountId: 1,
            contractId: 'CON.F.US.ENQ.U25',
            symbolId: 'NQ',
            creationTimestamp: '2025-01-15T10:00:00Z',
            updateTimestamp: '2025-01-15T10:00:00Z',
            status: OrderStatus.Open,
            type: OrderType.Limit,
            side: OrderSide.Ask,
            size: 2,
            limitPrice: 4600.00,
            stopPrice: null,
            fillVolume: 0,
            filledPrice: null,
            customTag: null,
          },
        ],
      };
      http.post.mockResolvedValue(mockResponse);

      const request = { accountId: 1 };
      const result = await service.searchOpen(request);

      expect(http.post).toHaveBeenCalledWith('/api/Order/searchOpen', request);
      expect(result).toEqual(mockResponse.orders);
    });
  });

  describe('cancel', () => {
    it('calls /api/Order/cancel and returns undefined', async () => {
      const mockResponse: CancelOrderResponse = {
        success: true,
        errorCode: 0,
        errorMessage: null,
      };
      http.post.mockResolvedValue(mockResponse);

      const request = { accountId: 1, orderId: 9056 };
      const result = await service.cancel(request);

      expect(http.post).toHaveBeenCalledWith('/api/Order/cancel', request);
      expect(result).toBeUndefined();
    });
  });

  describe('modify', () => {
    it('calls /api/Order/modify and returns undefined', async () => {
      const mockResponse: ModifyOrderResponse = {
        success: true,
        errorCode: 0,
        errorMessage: null,
      };
      http.post.mockResolvedValue(mockResponse);

      const request = { accountId: 1, orderId: 9056, limitPrice: 4550.00 };
      const result = await service.modify(request);

      expect(http.post).toHaveBeenCalledWith('/api/Order/modify', request);
      expect(result).toBeUndefined();
    });
  });
});
