// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const useQueryMock = vi.fn();
vi.mock('convex/react', () => ({ useQuery: (...a: unknown[]) => useQueryMock(...a) }));

import { backoffDelay, resetReconnectingForTests, useResilientQuery } from './resilient';

const ref = {} as never;
const useHook = useResilientQuery as (...a: unknown[]) => unknown;

beforeEach(() => { vi.useFakeTimers(); useQueryMock.mockReset(); resetReconnectingForTests(); });
afterEach(() => vi.useRealTimers());

describe('backoffDelay', () => {
  it('doubles from 1s and caps at 30s', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(backoffDelay)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
  });
});

describe('useResilientQuery', () => {
  it('returns undefined (loading) and retries when the first load throws', () => {
    let fail = true;
    useQueryMock.mockImplementation((_r, args) => {
      if (args === 'skip') return undefined;
      if (fail) throw new Error('Could not find public function');
      return ['ok'];
    });
    const { result } = renderHook(() => useResilientQuery(ref, {}));
    expect(result.current).toBeUndefined();
    fail = false;
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current).toEqual(['ok']);
  });

  it('keeps the last good data while failing, then recovers with growing backoff', () => {
    let mode: 'good' | 'bad' | 'recovered' = 'good';
    useQueryMock.mockImplementation((_r, args) => {
      if (args === 'skip') return undefined;
      if (mode === 'bad') throw new Error('boom');
      return mode === 'good' ? ['a'] : ['b'];
    });
    const { result, rerender } = renderHook(() => useResilientQuery(ref, {}));
    expect(result.current).toEqual(['a']);
    mode = 'bad';
    rerender();
    expect(result.current).toEqual(['a']);
    act(() => { vi.advanceTimersByTime(1000); }); // retry #1 fails
    expect(result.current).toEqual(['a']);
    act(() => { vi.advanceTimersByTime(1000); }); // second wait is 2s, so nothing yet
    mode = 'recovered';
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current).toEqual(['b']);
  });

  it('does not leak data across different args', () => {
    useQueryMock.mockImplementation((_r, args) => {
      if (args === 'skip') return undefined;
      if (args.id === 2) throw new Error('boom');
      return `data-${args.id}`;
    });
    const { result, rerender } = renderHook(({ id }: { id: number }) => useHook(ref, { id }), { initialProps: { id: 1 } });
    expect(result.current).toBe('data-1');
    rerender({ id: 2 });
    expect(result.current).toBeUndefined();
  });
});
