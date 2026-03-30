import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PositionService } from '../../src/api/position-service.js';
import type { HttpClient } from '../../src/http/http-client.js';
import { PositionType } from '../../src/types/index.js';
import type {
  PositionSearchResponse,
  ClosePositionResponse,
  PartialClosePositionResponse,
} from '../../src/types/index.js';

function createMockHttp() {
  return { post: vi.fn() } as unknown as HttpClient & { post: ReturnType<typeof vi.fn> };
}

describe('PositionService', () => {
  let http: ReturnType<typeof createMockHttp>;
  let service: PositionService;

  beforeEach(() => {
    http = createMockHttp();
    service = new PositionService(http);
  });

  describe('searchOpen', () => {
    it('calls /api/Position/searchOpen and returns positions array', async () => {
      const mockResponse: PositionSearchResponse = {
        success: true,
        errorCode: 0,
        errorMessage: null,
        positions: [
          {
            id: 1,
            accountId: 1,
            contractId: 'CON.F.US.ENQ.U25',
            creationTimestamp: '2025-01-15T10:00:00Z',
            type: PositionType.Long,
            size: 2,
            averagePrice: 4500.25,
          },
        ],
      };
      http.post.mockResolvedValue(mockResponse);

      const request = { accountId: 1 };
      const result = await service.searchOpen(request);

      expect(http.post).toHaveBeenCalledWith('/api/Position/searchOpen', request);
      expect(result).toEqual(mockResponse.positions);
    });
  });

  describe('closeContract', () => {
    it('calls /api/Position/closeContract and returns undefined', async () => {
      const mockResponse: ClosePositionResponse = {
        success: true,
        errorCode: 0,
        errorMessage: null,
      };
      http.post.mockResolvedValue(mockResponse);

      const request = { accountId: 1, contractId: 'CON.F.US.ENQ.U25' };
      const result = await service.closeContract(request);

      expect(http.post).toHaveBeenCalledWith('/api/Position/closeContract', request, { retries: 0 });
      expect(result).toBeUndefined();
    });
  });

  describe('partialCloseContract', () => {
    it('calls /api/Position/partialCloseContract and returns undefined', async () => {
      const mockResponse: PartialClosePositionResponse = {
        success: true,
        errorCode: 0,
        errorMessage: null,
      };
      http.post.mockResolvedValue(mockResponse);

      const request = { accountId: 1, contractId: 'CON.F.US.ENQ.U25', size: 1 };
      const result = await service.partialCloseContract(request);

      expect(http.post).toHaveBeenCalledWith('/api/Position/partialCloseContract', request, { retries: 0 });
      expect(result).toBeUndefined();
    });
  });
});
