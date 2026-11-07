import type { Listing } from '../listings/types';

export type View = { south: number; west: number; north: number; east: number; zoom: number };
export type Pin = { listing: Listing; recommended: boolean };

export const NEARBY_MIN_ZOOM = 11;
export const PIN_CAP = 300;
// Degrees; a town whose centre is just off screen can still have homes on screen.
const TOWN_PAD = 0.08;

const inside = (v: View, lat: number, lng: number, pad = 0) =>
  lat >= v.south - pad && lat <= v.north + pad && lng >= v.west - pad && lng <= v.east + pad;

/** Towns worth fetching at this view; empty below the minimum zoom. */
export function townsInView(cities: readonly { id: string; lat: number; lng: number }[], v: View): string[] {
  if (v.zoom < NEARBY_MIN_ZOOM) return [];
  return cities.filter(c => inside(v, c.lat, c.lng, TOWN_PAD)).map(c => c.id);
}

/**
 * Recommended listings always show. Nearby ones fill the rest of the cap, nearest the view centre first,
 * and only those actually in view. Duplicates keep their recommended flag.
 */
export function selectPins(recommended: readonly Listing[], nearby: readonly Listing[], v: View, cap = PIN_CAP): Pin[] {
  const pins: Pin[] = recommended.slice(0, cap).map(listing => ({ listing, recommended: true }));
  if (v.zoom < NEARBY_MIN_ZOOM) return pins;
  const seen = new Set(pins.map(p => p.listing.id));
  const lat = (v.south + v.north) / 2;
  const lng = (v.west + v.east) / 2;
  const dist = (l: Listing) => (l.lat - lat) ** 2 + (l.lng - lng) ** 2;
  const rest = nearby
    .filter(l => !seen.has(l.id) && inside(v, l.lat, l.lng))
    .sort((a, b) => dist(a) - dist(b) || a.id.localeCompare(b.id));
  const out = [...pins];
  for (const listing of rest) {
    if (out.length >= cap) break;
    if (seen.has(listing.id)) continue;
    seen.add(listing.id);
    out.push({ listing, recommended: false });
  }
  return out;
}

/** Last answer for this kind while the next one loads, so pins do not blink when weights change. A kind switch shows nothing until its own answer lands. */
export function keepForKind<T>(prev: { kind: string; value: T } | undefined, kind: string, fresh: T | undefined): { kind: string; value: T } | undefined {
  return fresh !== undefined ? { kind, value: fresh } : prev?.kind === kind ? prev : undefined;
}
