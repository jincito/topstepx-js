/** Pluggable token persistence interface (AUTH-05). */
export interface TokenStore {
  getToken(): Promise<string | null> | string | null;
  setToken(token: string, expiresAt: number): Promise<void> | void;
  clear(): Promise<void> | void;
}

export class MemoryTokenStore implements TokenStore {
  private token: string | null = null;
  private expiresAt: number = 0;

  getToken(): string | null {
    if (this.token && Date.now() < this.expiresAt) {
      return this.token;
    }
    return null;
  }

  setToken(token: string, expiresAt: number): void {
    this.token = token;
    this.expiresAt = expiresAt;
  }

  clear(): void {
    this.token = null;
    this.expiresAt = 0;
  }
}
