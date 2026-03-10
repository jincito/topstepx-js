import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TopstepXProvider, useTopstepX } from '../../src/react/context.js';

vi.mock('../../src/client/topstepx-client.js', () => ({
  TopstepXClient: class MockClient {
    accounts = { search: vi.fn().mockResolvedValue([]) };
    disconnect = vi.fn();
  },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <TopstepXProvider credentials={{ userName: 'test', apiKey: 'key' }}>
      {children}
    </TopstepXProvider>
  );
}

describe('TopstepXProvider + useTopstepX', () => {
  it('useTopstepX returns client from provider', () => {
    const { result } = renderHook(() => useTopstepX(), { wrapper });

    expect(result.current).toBeTruthy();
    expect(result.current).toHaveProperty('accounts');
    expect(result.current).toHaveProperty('disconnect');
  });

  it('useTopstepX throws outside provider', () => {
    expect(() => {
      renderHook(() => useTopstepX());
    }).toThrow('useTopstepX must be used within a TopstepXProvider');
  });

  it('provider calls disconnect on unmount', () => {
    const { result, unmount } = renderHook(() => useTopstepX(), { wrapper });

    const client = result.current;
    expect(client.disconnect).not.toHaveBeenCalled();

    unmount();

    expect(client.disconnect).toHaveBeenCalled();
  });

  it('provider creates client only once across re-renders', () => {
    const { result, rerender } = renderHook(() => useTopstepX(), { wrapper });

    const firstClient = result.current;

    rerender();

    const secondClient = result.current;
    expect(secondClient).toBe(firstClient);
  });
});
