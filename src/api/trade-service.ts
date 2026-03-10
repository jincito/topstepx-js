import type { HttpClient } from '../http/http-client.js';
import type {
  TradeSearchRequest,
  TradeSearchResponse,
  Trade,
} from '../types/index.js';

export class TradeService {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async search(request: TradeSearchRequest): Promise<Trade[]> {
    const response = await this.http.post<TradeSearchResponse>(
      '/api/Trade/search',
      request,
    );
    return response.trades;
  }
}
