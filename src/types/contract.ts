import type { ApiResponse } from './common.js';

/** Request body for POST /api/Contract/available */
export interface ContractAvailableRequest {
  live: boolean;
}

/** Request body for POST /api/Contract/search */
export interface ContractSearchRequest {
  searchText: string;
  live: boolean;
}

/** Request body for POST /api/Contract/searchById */
export interface ContractSearchByIdRequest {
  contractId: string;
}

/** Contract entity returned by the API */
export interface Contract {
  id: string;
  name: string;
  description: string;
  tickSize: number;
  tickValue: number;
  activeContract: boolean;
  symbolId: string;
}

/** Response from contract search endpoints */
export interface ContractSearchResponse extends ApiResponse {
  contracts: Contract[];
}
