import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TradeService } from '../../src/api/trade-service.js';
import type { HttpClient } from '../../src/http/http-client.js';
import { OrderSide } from '../../src/types/index.js';
import type { TradeSearchResponse } from '../../src/types/index.js';

function createMockHttp() {
  return { post: vi.fn() } as unknown as HttpClient & { post: ReturnType<typeof vi.fn> };
}

describe('TradeService', () => {
  let http: ReturnType<typeof createMockHttp>;
  let service: TradeService;

  beforeEach(() => {
    http = createMockHttp();
    service = new TradeService(http);
  });

  describe('search', () => {
    it('calls /api/Trade/search and returns trades array', async () => {
      const mockResponse: TradeSearchResponse = {
        success: true,
        errorCode: 0,
        errorMessage: null,
        trades: [
          {
            id: 1,
            accountId: 1,
            contractId: 'CON.F.US.ENQ.U25',
            creationTimestamp: '2025-01-15T10:00:01Z',
            price: 4500.25,
            profitAndLoss: null,
            fees: 2.50,
            side: OrderSide.Bid,
            size: 1,
            voided: false,
            orderId: 9056,
          },
        ],
      };
      http.post.mockResolvedValue(mockResponse);

      const request = { accountId: 1, startTimestamp: '2025-01-01T00:00:00Z' };
      const result = await service.search(request);

      expect(http.post).toHaveBeenCalledWith('/api/Trade/search', request);
      expect(result).toEqual(mockResponse.trades);
    });
  });
});
