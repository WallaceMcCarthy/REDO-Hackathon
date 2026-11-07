export const MAX_BODY = 500;
export const HIDE_AT_REPORTS = 3;
export const RATE_LIMIT_POSTS = 5;
export const RATE_LIMIT_WINDOW_MS = 60_000;

export type BodyResult = { ok: true; body: string } | { ok: false; error: string };

export function validateBody(raw: string): BodyResult {
  const body = raw.trim();
  if (!body) return { ok: false, error: "Write something first." };
  if (body.length > MAX_BODY) return { ok: false, error: `Posts are limited to ${MAX_BODY} characters.` };
  return { ok: true, body };
}

export const shouldHide = (reports: number) => reports >= HIDE_AT_REPORTS;

/** Like toggle: returns the new count; never below zero even if the stored count drifted. */
export const nextLikes = (likes: number, wasLiked: boolean) =>
  wasLiked ? Math.max(0, likes - 1) : likes + 1;

/** `recentDesc` = the user's latest creation times, newest first (need at most RATE_LIMIT_POSTS). */
export const isRateLimited = (recentDesc: number[], now: number) =>
  recentDesc.filter((t) => now - t < RATE_LIMIT_WINDOW_MS).length >= RATE_LIMIT_POSTS;

export const newestFirst = <T extends { _creationTime: number }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => b._creationTime - a._creationTime);
