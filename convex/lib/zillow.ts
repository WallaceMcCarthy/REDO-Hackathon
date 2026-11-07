/** Zillow URL builder and Microlink preview helpers shared by the frontend and Convex. */

/** Zillow address search (opens the property page or nearest match). Falls back to the town's Zillow page. */
export function zillowUrl(address: string | null, cityName: string | undefined, kind: string): string {
  const town = cityName ?? '';
  if (address && address.trim()) {
    const full = /\bUT\b/.test(address) ? address : `${address}, ${town}, UT`;
    return `https://www.zillow.com/homes/${encodeURIComponent(full.replace(/\s+/g, ' ').trim()).replace(/%20/g, '-')}_rb/`;
  }
  const slug = town.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return kind === 'apartment' ? `https://www.zillow.com/${slug}-ut/apartments/` : `https://www.zillow.com/${slug}-ut/`;
}

export const MICROLINK_DAILY_CAP = 45;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const RECENT_FETCH_MS = 10 * 60 * 1000;
export const ERROR_RETRY_MS = 5 * 60 * 1000;
export const FETCH_TIMEOUT_MS = 25000;

export type PreviewStatus = 'ok' | 'no_image' | 'error';
export interface PreviewFields {
  pageUrl: string | null;
  imageUrl: string | null;
  title: string | null;
  status: PreviewStatus;
}
export interface PreviewRowLike { status: PreviewStatus; fetchedAt: number }

export type FetchDecision = 'cached' | 'budget_exhausted' | 'fetch';

/**
 * Decide whether to call Microlink. Settled rows (ok / no_image) are final; an error row is
 * final only until its 1 hour retry window passes; anything fetched in the last 10 minutes is
 * never refetched. The free-tier cap applies only when no API key is configured.
 */
export function decideFetch(opts: { row: PreviewRowLike | null; now: number; callsLast24h: number; hasApiKey: boolean }): FetchDecision {
  const { row, now, callsLast24h, hasApiKey } = opts;
  if (row) {
    const age = now - row.fetchedAt;
    if (row.status !== 'error') return 'cached';
    if (age < RECENT_FETCH_MS || age < ERROR_RETRY_MS) return 'cached';
  }
  if (!hasApiKey && callsLast24h >= MICROLINK_DAILY_CAP) return 'budget_exhausted';
  return 'fetch';
}

export function microlinkRequest(requestUrl: string, apiKey?: string): { url: string; headers: Record<string, string> } {
  const base = apiKey ? 'https://pro.microlink.io/' : 'https://api.microlink.io/';
  return { url: `${base}?url=${encodeURIComponent(requestUrl)}`, headers: apiKey ? { 'x-api-key': apiKey } : {} };
}

const str = (x: unknown): string | null => (typeof x === 'string' && x ? x : null);

/** Parse a Microlink JSON body; anything unexpected becomes an 'error' result. */
export function parseMicrolink(body: unknown): PreviewFields {
  const b = body as { status?: unknown; data?: { title?: unknown; url?: unknown; image?: { url?: unknown } | null } } | null;
  if (!b || b.status !== 'success' || !b.data || typeof b.data !== 'object') {
    return { pageUrl: null, imageUrl: null, title: null, status: 'error' };
  }
  const imageUrl = str(b.data.image?.url);
  return { pageUrl: str(b.data.url), imageUrl, title: str(b.data.title), status: imageUrl ? 'ok' : 'no_image' };
}
