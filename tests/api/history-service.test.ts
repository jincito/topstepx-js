import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HistoryService } from '../../src/api/history-service.js';
import type { HttpClient } from '../../src/http/http-client.js';
import { BarUnit } from '../../src/types/index.js';
import type { RetrieveBarsResponse } from '../../src/types/index.js';

function createMockHttp() {
  return { post: vi.fn() } as unknown as HttpClient & { post: ReturnType<typeof vi.fn> };
}

describe('HistoryService', () => {
  let http: ReturnType<typeof createMockHttp>;
  let service: HistoryService;

  beforeEach(() => {
    http = createMockHttp();
    service = new HistoryService(http);
  });

  describe('retrieveBars', () => {
    it('calls /api/History/retrieveBars and returns bars array', async () => {
      const mockResponse: RetrieveBarsResponse = {
        success: true,
        errorCode: 0,
        errorMessage: null,
        bars: [
          { t: '2025-01-15T10:00:00Z', o: 4500.25, h: 4510.50, l: 4498.00, c: 4505.75, v: 1200 },
        ],
      };
      http.post.mockResolvedValue(mockResponse);

      const request = {
        contractId: 'CON.F.US.ENQ.U25',
        live: true,
        startTime: '2025-01-15T00:00:00Z',
        endTime: '2025-01-15T23:59:59Z',
        unit: BarUnit.Minute,
        unitNumber: 5,
        limit: 100,
        includePartialBar: false,
      };
      const result = await service.retrieveBars(request);

      expect(http.post).toHaveBeenCalledWith('/api/History/retrieveBars', request);
      expect(result).toEqual(mockResponse.bars);
    });
  });
});
