import type { Credentials } from '../types/config.js';
import type { AuthResponse, ValidateResponse } from '../types/auth.js';
import type { TokenStore } from './token-store.js';
import { MemoryTokenStore } from './token-store.js';
import { AuthError } from '../errors/index.js';

const TOKEN_VALIDITY_MS = 24 * 60 * 60 * 1000;
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

export class AuthManager {
  private refreshPromise: Promise<string> | null = null;
  private store: TokenStore;
  private credentials: Credentials;
  private baseUrl: string;

  constructor(credentials: Credentials, baseUrl: string, store?: TokenStore) {
    this.credentials = credentials;
    this.baseUrl = baseUrl;
    this.store = store ?? new MemoryTokenStore();
  }

  async getToken(): Promise<string> {
    const existing = await this.store.getToken();
    if (existing) return existing;
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.performAuth();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  async logout(): Promise<void> {
    await this.store.clear();
    this.refreshPromise = null;
  }

  async validate(currentToken: string): Promise<string> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/Auth/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
        },
      });
    } catch {
      await this.store.clear();
      return this.login();
    }
    if (!response.ok) {
      await this.store.clear();
      return this.login();
    }
    const data = (await response.json()) as ValidateResponse;
    if (!data.success) {
      await this.store.clear();
      return this.login();
    }
    const expiresAt = Date.now() + TOKEN_VALIDITY_MS - TOKEN_REFRESH_BUFFER_MS;
    await this.store.setToken(data.newToken, expiresAt);
    return data.newToken;
  }

  private async performAuth(): Promise<string> {
    return this.login();
  }

  private async login(): Promise<string> {
    const isApiKey = 'apiKey' in this.credentials;
    const endpoint = isApiKey ? '/api/Auth/loginKey' : '/api/Auth/loginApp';
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.credentials),
      });
    } catch (error) {
      throw new AuthError(
        0,
        `Login request failed: ${error instanceof Error ? error.message : 'Network error'}`,
      );
    }
    if (!response.ok) {
      throw new AuthError(0, `Login failed: HTTP ${response.status}`);
    }
    const data = (await response.json()) as AuthResponse;
    if (!data.success) {
      throw new AuthError(data.errorCode, data.errorMessage ?? 'Login failed');
    }
    const expiresAt = Date.now() + TOKEN_VALIDITY_MS - TOKEN_REFRESH_BUFFER_MS;
    await this.store.setToken(data.token, expiresAt);
    return data.token;
  }
}
