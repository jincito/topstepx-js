import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountService } from '../../src/api/account-service.js';
import type { HttpClient } from '../../src/http/http-client.js';
import type { AccountSearchResponse } from '../../src/types/index.js';

function createMockHttp() {
  return { post: vi.fn() } as unknown as HttpClient & { post: ReturnType<typeof vi.fn> };
}

describe('AccountService', () => {
  let http: ReturnType<typeof createMockHttp>;
  let service: AccountService;

  beforeEach(() => {
    http = createMockHttp();
    service = new AccountService(http);
  });

  describe('search', () => {
    it('calls /api/Account/search and returns accounts array', async () => {
      const mockResponse: AccountSearchResponse = {
        success: true,
        errorCode: 0,
        errorMessage: null,
        accounts: [
          { id: 1, name: 'Test Account', balance: 50000, canTrade: true, isVisible: true },
        ],
      };
      http.post.mockResolvedValue(mockResponse);

      const request = { onlyActiveAccounts: true };
      const result = await service.search(request);

      expect(http.post).toHaveBeenCalledWith('/api/Account/search', request);
      expect(result).toEqual(mockResponse.accounts);
    });
  });
});
