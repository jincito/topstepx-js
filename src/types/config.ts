import type { TokenStore } from '../auth/token-store.js';

/** Credentials for API key authentication (POST /api/Auth/loginKey) */
export interface ApiKeyCredentials {
  userName: string;
  apiKey: string;
}

/** Credentials for authorized application authentication (POST /api/Auth/loginApp) */
export interface AppCredentials {
  userName: string;
  password: string;
  deviceId: string;
  appId: string;
  verifyKey: string;
}

/** Union of supported credential types */
export type Credentials = ApiKeyCredentials | AppCredentials;

/** Optional configuration for the TopstepX SDK client */
export interface TopstepXOptions {
  /** Base URL for REST API (default: https://api.topstepx.com) */
  baseUrl?: string;
  /** Base URL for real-time hubs (default: https://rtc.topstepx.com) */
  rtcUrl?: string;
  /** Optional pluggable token persistence (default: in-memory) */
  tokenStore?: TokenStore;
}

/** 
 * Legacy configuration interface - deprecated, use createClient() instead.
 * @deprecated Use createClient(userName, apiKey, options?) instead
 */
export interface TopstepXConfig {
  credentials: Credentials;
  /** Base URL for REST API (default: https://api.topstepx.com) */
  baseUrl?: string;
  /** Base URL for real-time hubs (default: https://rtc.topstepx.com) */
  rtcUrl?: string;
  /** Optional pluggable token persistence (default: in-memory) */
  tokenStore?: TokenStore;
}
