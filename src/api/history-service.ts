import type { HttpClient } from '../http/http-client.js';
import type {
  RetrieveBarsRequest,
  RetrieveBarsResponse,
  Bar,
} from '../types/index.js';

export class HistoryService {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async retrieveBars(request: RetrieveBarsRequest): Promise<Bar[]> {
    const response = await this.http.post<RetrieveBarsResponse>(
      '/api/History/retrieveBars',
      request,
    );
    return response.bars;
  }
}
