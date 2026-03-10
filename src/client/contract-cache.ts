import type { Contract } from '../types/index.js';

interface CacheEntry {
  data: Contract[];
  expiresAt: number;
}

/**
 * Simple TTL cache for contract query results.
 *
 * Stores arrays of Contract objects keyed by a string identifier.
 * Entries automatically expire after the configured TTL (default 5 minutes).
 */
export class ContractCache {
  private cache = new Map<string, CacheEntry>();
  private readonly ttlMs: number;

  constructor(ttlMs: number = 5 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  /** Get cached contracts by key, or null if missing/expired. */
  get(key: string): Contract[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  /** Store contracts under the given key with automatic TTL expiry. */
  set(key: string, data: Contract[]): void {
    this.cache.set(key, { data, expiresAt: Date.now() + this.ttlMs });
  }

  /** Remove all cached entries. */
  clear(): void {
    this.cache.clear();
  }

  /** Number of entries currently in the cache (including potentially expired). */
  get size(): number {
    return this.cache.size;
  }
}
