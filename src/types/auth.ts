import type { ApiResponse } from './common.js';

/** Request body for POST /api/Auth/loginKey */
export interface LoginKeyRequest {
  userName: string;
  apiKey: string;
}

/** Request body for POST /api/Auth/loginApp */
export interface LoginAppRequest {
  userName: string;
  password: string;
  deviceId: string;
  appId: string;
  verifyKey: string;
}

/** Response from POST /api/Auth/loginKey or /api/Auth/loginApp */
export interface AuthResponse extends ApiResponse {
  token: string;
}

/** Response from POST /api/Auth/validate */
export interface ValidateResponse extends ApiResponse {
  newToken: string;
}
