import type { HttpClient } from '../http/http-client.js';
import type {
  ContractAvailableRequest,
  ContractSearchRequest,
  ContractSearchByIdRequest,
  ContractSearchResponse,
  Contract,
} from '../types/index.js';

export class ContractService {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async available(request: ContractAvailableRequest): Promise<Contract[]> {
    const response = await this.http.post<ContractSearchResponse>(
      '/api/Contract/available',
      request,
    );
    return response.contracts;
  }

  async search(request: ContractSearchRequest): Promise<Contract[]> {
    const response = await this.http.post<ContractSearchResponse>(
      '/api/Contract/search',
      request,
    );
    return response.contracts;
  }

  async searchById(request: ContractSearchByIdRequest): Promise<Contract[]> {
    const response = await this.http.post<ContractSearchResponse>(
      '/api/Contract/searchById',
      request,
    );
    return response.contracts;
  }
}
