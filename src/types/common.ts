/** Base shape shared by all TopstepX API responses */
export interface ApiResponse {
  /** Whether the request succeeded */
  success: boolean;
  /** Numeric error code (0 = no error) */
  errorCode: number;
  /** Human-readable error message, null when success is true */
  errorMessage: string | null;
}
