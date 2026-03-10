import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ContractCache } from '../../src/client/contract-cache.js';
import type { Contract } from '../../src/types/index.js';

function fakeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 'CON.F.US.ENQ.U25',
    name: 'E-mini NASDAQ',
    description: 'E-mini NASDAQ-100 Futures',
    tickSize: 0.25,
    tickValue: 5,
    activeContract: true,
    symbolId: 'NQ',
    ...overrides,
  };
}

describe('ContractCache', () => {
  let cache: ContractCache;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new ContractCache(5000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for missing key', () => {
    expect(cache.get('missing')).toBeNull();
  });

  it('returns cached data within TTL', () => {
    const contracts = [fakeContract({ id: 'C1' }), fakeContract({ id: 'C2' })];
    cache.set('test-key', contracts);

    const result = cache.get('test-key');
    expect(result).toEqual(contracts);
  });

  it('returns null after TTL expires', () => {
    cache.set('test-key', [fakeContract()]);

    vi.advanceTimersByTime(5001);

    expect(cache.get('test-key')).toBeNull();
  });

  it('deletes expired entry on access (lazy deletion)', () => {
    cache.set('test-key', [fakeContract()]);
    expect(cache.size).toBe(1);

    vi.advanceTimersByTime(5001);

    // Access triggers lazy deletion
    cache.get('test-key');
    expect(cache.size).toBe(0);
  });

  it('clear() removes all entries', () => {
    cache.set('key-1', [fakeContract({ id: 'C1' })]);
    cache.set('key-2', [fakeContract({ id: 'C2' })]);
    expect(cache.size).toBe(2);

    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('size returns number of entries', () => {
    cache.set('a', [fakeContract({ id: 'A' })]);
    cache.set('b', [fakeContract({ id: 'B' })]);
    cache.set('c', [fakeContract({ id: 'C' })]);

    expect(cache.size).toBe(3);
  });

  it('overwrites existing key', () => {
    const dataA = [fakeContract({ id: 'A' })];
    const dataB = [fakeContract({ id: 'B' })];

    cache.set('key', dataA);
    cache.set('key', dataB);

    expect(cache.get('key')).toEqual(dataB);
    expect(cache.size).toBe(1);
  });
});
