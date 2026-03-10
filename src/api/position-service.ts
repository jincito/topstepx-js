import type { HttpClient } from '../http/http-client.js';
import type {
  PositionSearchOpenRequest,
  ClosePositionRequest,
  PartialClosePositionRequest,
  PositionSearchResponse,
  ClosePositionResponse,
  PartialClosePositionResponse,
  Position,
} from '../types/index.js';

export class PositionService {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async searchOpen(request: PositionSearchOpenRequest): Promise<Position[]> {
    const response = await this.http.post<PositionSearchResponse>(
      '/api/Position/searchOpen',
      request,
    );
    return response.positions;
  }

  async closeContract(request: ClosePositionRequest): Promise<void> {
    await this.http.post<ClosePositionResponse>(
      '/api/Position/closeContract',
      request,
    );
  }

  async partialCloseContract(request: PartialClosePositionRequest): Promise<void> {
    await this.http.post<PartialClosePositionResponse>(
      '/api/Position/partialCloseContract',
      request,
    );
  }
}
