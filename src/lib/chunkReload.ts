import { lazy, type ComponentType } from 'react';

const FLAG = 'chunk-reload-at';
const COOLDOWN_MS = 30_000;
const CHUNK_RE = /importing a module script failed|failed to fetch dynamically imported module|error loading dynamically imported module|ChunkLoadError|Loading chunk .* failed/i;

export const isChunkError = (e: unknown) =>
  CHUNK_RE.test(`${(e as Error | undefined)?.name ?? ''} ${(e as Error | undefined)?.message ?? e ?? ''}`);

/** Reloads at most once per cooldown window. Returns true if a reload was triggered. */
export function reloadOnce(): boolean {
  try {
    const at = Number(sessionStorage.getItem(FLAG) ?? 0);
    if (Date.now() - at < COOLDOWN_MS) return false;
    sessionStorage.setItem(FLAG, String(Date.now()));
  } catch { return false; }
  window.location.reload();
  return true;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** React.lazy that retries the import (500ms, 1500ms), then reloads once if the chunk is gone. */
export function lazyWithRetry<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    let lastError: unknown;
    for (const wait of [0, 500, 1500]) {
      if (wait) await sleep(wait);
      try { return await factory(); } catch (e) { lastError = e; }
    }
    if (reloadOnce()) return new Promise<never>(() => {}); // page is reloading; stay on the skeleton
    throw lastError;
  });
}
