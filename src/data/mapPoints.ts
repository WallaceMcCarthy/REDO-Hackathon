import { useEffect, useState } from 'react';
import type { Listing, ListingKind } from '../../convex/lib/listings';

/** public/data/map-points-{kind}.json, written by scripts/data/map_points.ts. */
export type MapPointsFile = [id: string, lat: number, lng: number, price: number, cityId: string][];

/** What the map needs to draw a pin. A point from the file has only this; a Listing from the list has the rest too. */
export type MapPin = Pick<Listing, 'id' | 'cityId' | 'kind' | 'lat' | 'lng' | 'value' | 'rent'> & Partial<Listing>;

const files = new Map<ListingKind, Promise<MapPin[]>>();

function loadPoints(kind: ListingKind) {
  let file = files.get(kind);
  if (!file) {
    file = fetch(`/data/map-points-${kind}.json`)
      .then(res => { if (!res.ok) throw new Error(`Map points: HTTP ${res.status}`); return res.json() as Promise<MapPointsFile>; })
      .then(rows => rows.map(([id, lat, lng, price, cityId]) => ({ id, cityId, kind, lat, lng, value: kind === 'home' ? price : null, rent: kind === 'home' ? null : price })));
    files.set(kind, file);
    file.catch(() => files.delete(kind));
  }
  return file;
}

/** Every point of a kind, fetched the first time a map asks for it. `null` loads nothing. */
export function useMapPoints(kind: ListingKind | null) {
  const [loaded, setLoaded] = useState<{ kind: ListingKind; points: MapPin[] }>();
  useEffect(() => {
    if (!kind) return;
    let current = true;
    // On failure the map keeps showing the list's own pins, so there is nothing to tell the user.
    loadPoints(kind).then(points => { if (current) setLoaded({ kind, points }); }).catch(() => undefined);
    return () => { current = false; };
  }, [kind]);
  return loaded?.kind === kind ? loaded.points : undefined;
}

/** The list's loaded listings, plus every other point its budget and towns allow. */
export function mapPins(points: readonly MapPin[], loaded: readonly Listing[], maxPrice?: number, townIds?: ReadonlySet<string>): MapPin[] {
  const seen = new Set(loaded.map(l => l.id));
  return [...loaded, ...points.filter(p =>
    !seen.has(p.id) && (maxPrice === undefined || (p.value ?? p.rent)! <= maxPrice) && (!townIds || townIds.has(p.cityId)))];
}
