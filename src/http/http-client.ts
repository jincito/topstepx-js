import pRetry, { AbortError } from 'p-retry';
import type { AuthManager } from '../auth/auth-manager.js';
import { RateLimiter } from './rate-limiter.js';
import { ApiError, AuthError, RateLimitError, ConnectionError } from '../errors/index.js';
import type { ApiResponse } from '../types/common.js';

export class HttpClient {
  private auth: AuthManager;
  private rateLimiter: RateLimiter;
  private baseUrl: string;

  constructor(auth: AuthManager, baseUrl: string) {
    this.auth = auth;
    this.baseUrl = baseUrl;
    this.rateLimiter = new RateLimiter();
  }

  async post<T extends ApiResponse>(endpoint: string, body?: unknown): Promise<T> {
    return this.rateLimiter.execute(endpoint, () =>
      pRetry(
        async () => {
          const token = await this.auth.getToken();
          let response: Response;
          try {
            response = await fetch(`${this.baseUrl}${endpoint}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: body !== undefined ? JSON.stringify(body) : undefined,
            });
          } catch (error) {
            throw new AbortError(
              new ConnectionError('Network request failed', error instanceof Error ? error : undefined),
            );
          }
          if (response.status === 429) {
            throw new RateLimitError('Server rate limit exceeded');
          }
          if (response.status === 401) {
            throw new AbortError(new AuthError(0, 'Authentication failed'));
          }
          if (!response.ok) {
            throw new AbortError(
              new ApiError(0, `HTTP ${response.status}: ${response.statusText}`, response.status),
            );
          }
          const data = (await response.json()) as T;
          if (!data.success) {
            throw new AbortError(
              new ApiError(data.errorCode, data.errorMessage ?? 'Unknown API error'),
            );
          }
          return data;
        },
        {
          retries: 3,
          shouldRetry: ({ error }) => error instanceof RateLimitError,
          minTimeout: 1_000,
          factor: 2,
          randomize: true,
        },
      ),
    );
  }
}
