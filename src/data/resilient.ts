// Resilient data loading: transient Convex errors (redeploys, missing functions, network/server
// blips) are retried with backoff while the last good data stays on screen.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useQuery } from 'convex/react';
import { ConvexError } from 'convex/values';

/** Deliberate application errors will not fix themselves, so they are not retried. */
export const isPermanentError = (e: unknown) => e instanceof ConvexError;

export const BACKOFF_MAX_MS = 30_000;
/** 1s, 2s, 4s, ... capped at 30s. */
export const backoffDelay = (attempt: number) => Math.min(1000 * 2 ** attempt, BACKOFF_MAX_MS);

// Global "reconnecting" counter so one unobtrusive pill can reflect every failing query.
let reconnecting = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
export const setReconnecting = (delta: 1 | -1) => { reconnecting = Math.max(0, reconnecting + delta); emit(); };
export const useIsReconnecting = () =>
  useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l); }; }, () => reconnecting > 0, () => false);
export const resetReconnectingForTests = () => { reconnecting = 0; emit(); };

type QueryArgs = Parameters<typeof useQuery>;

/**
 * Drop-in replacement for convex useQuery that never throws. On error it unsubscribes, waits with
 * backoff, resubscribes, and meanwhile returns the last good result (undefined if there was none,
 * so callers keep showing skeletons).
 */
function useResilientQueryImpl(...[ref, args]: QueryArgs): unknown {
  const [paused, setPaused] = useState(false);
  const [attempt, setAttempt] = useState(0);

  let value: unknown;
  let error: unknown;
  try {
    value = useQuery(ref, paused ? 'skip' : args);
  } catch (e) {
    if (isPermanentError(e)) throw e;
    error = e ?? new Error('query failed');
  }

  const argsKey = args === 'skip' ? 'skip' : JSON.stringify(args ?? null);
  const last = useRef<{ key: string; value: unknown } | undefined>(undefined);
  if (!error && !paused && value !== undefined) last.current = { key: argsKey, value };
  if (last.current && last.current.key !== argsKey) last.current = undefined;

  const failing = error !== undefined || paused;
  useEffect(() => { if (error !== undefined) setPaused(true); }, [error]);
  useEffect(() => {
    if (!paused) return;
    const t = setTimeout(() => { setAttempt(a => a + 1); setPaused(false); }, backoffDelay(attempt));
    return () => clearTimeout(t);
  }, [paused, attempt]);
  useEffect(() => { if (!failing && value !== undefined) setAttempt(0); }, [failing, value]);
  useEffect(() => {
    if (!failing) return;
    setReconnecting(1);
    return () => setReconnecting(-1);
  }, [failing]);

  return failing ? last.current?.value : value;
}

export const useResilientQuery = useResilientQueryImpl as unknown as typeof useQuery;
