import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContractService } from '../../src/api/contract-service.js';
import type { HttpClient } from '../../src/http/http-client.js';
import type { ContractSearchResponse } from '../../src/types/index.js';

function createMockHttp() {
  return { post: vi.fn() } as unknown as HttpClient & { post: ReturnType<typeof vi.fn> };
}

const mockContract = {
  id: 'CON.F.US.ENQ.U25',
  name: 'E-Mini NASDAQ',
  description: 'E-Mini NASDAQ-100 Futures',
  tickSize: 0.25,
  tickValue: 5,
  activeContract: true,
  symbolId: 'NQ',
};

describe('ContractService', () => {
  let http: ReturnType<typeof createMockHttp>;
  let service: ContractService;

  beforeEach(() => {
    http = createMockHttp();
    service = new ContractService(http);
  });

  describe('available', () => {
    it('calls /api/Contract/available and returns contracts array', async () => {
      const mockResponse: ContractSearchResponse = {
        success: true,
        errorCode: 0,
        errorMessage: null,
        contracts: [mockContract],
      };
      http.post.mockResolvedValue(mockResponse);

      const request = { live: true };
      const result = await service.available(request);

      expect(http.post).toHaveBeenCalledWith('/api/Contract/available', request);
      expect(result).toEqual(mockResponse.contracts);
    });
  });

  describe('search', () => {
    it('calls /api/Contract/search and returns contracts array', async () => {
      const mockResponse: ContractSearchResponse = {
        success: true,
        errorCode: 0,
        errorMessage: null,
        contracts: [mockContract],
      };
      http.post.mockResolvedValue(mockResponse);

      const request = { searchText: 'NQ', live: true };
      const result = await service.search(request);

      expect(http.post).toHaveBeenCalledWith('/api/Contract/search', request);
      expect(result).toEqual(mockResponse.contracts);
    });
  });

  describe('searchById', () => {
    it('calls /api/Contract/searchById and returns contracts array', async () => {
      const mockResponse: ContractSearchResponse = {
        success: true,
        errorCode: 0,
        errorMessage: null,
        contracts: [mockContract],
      };
      http.post.mockResolvedValue(mockResponse);

      const request = { contractId: 'CON.F.US.ENQ.U25' };
      const result = await service.searchById(request);

      expect(http.post).toHaveBeenCalledWith('/api/Contract/searchById', request);
      expect(result).toEqual(mockResponse.contracts);
    });
  });
});
