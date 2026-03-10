import type { HttpClient } from '../http/http-client.js';
import type {
  AccountSearchRequest,
  AccountSearchResponse,
  Account,
} from '../types/index.js';

export class AccountService {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async search(request: AccountSearchRequest): Promise<Account[]> {
    const response = await this.http.post<AccountSearchResponse>(
      '/api/Account/search',
      request,
    );
    return response.accounts;
  }
}
