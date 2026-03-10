/**
 * Base error for all TopstepX API errors.
 * Contains the raw errorCode and errorMessage from the API response.
 */
export class ApiError extends Error {
  public readonly errorCode: number;
  public readonly errorMessage: string;
  public readonly statusCode?: number;

  constructor(errorCode: number, errorMessage: string, statusCode?: number) {
    super(errorMessage);
    this.name = 'ApiError';
    this.errorCode = errorCode;
    this.errorMessage = errorMessage;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Authentication failed (HTTP 401 or auth-related errorCode).
 * Thrown when token is invalid, expired, or credentials are wrong.
 */
export class AuthError extends ApiError {
  constructor(errorCode: number, errorMessage: string) {
    super(errorCode, errorMessage, 401);
    this.name = 'AuthError';
  }
}

/**
 * Rate limit exceeded (HTTP 429).
 * The SDK's rate limiter should prevent most of these,
 * but this handles server-side enforcement.
 */
export class RateLimitError extends ApiError {
  constructor(errorMessage: string = 'Rate limit exceeded') {
    super(0, errorMessage, 429);
    this.name = 'RateLimitError';
  }
}

/**
 * Connection-level error (network failure, timeout, WebSocket disconnect).
 * Not an API business error -- the request never completed.
 */
export class ConnectionError extends ApiError {
  public readonly cause?: Error;

  constructor(errorMessage: string, cause?: Error) {
    super(0, errorMessage, undefined);
    this.name = 'ConnectionError';
    this.cause = cause;
  }
}
