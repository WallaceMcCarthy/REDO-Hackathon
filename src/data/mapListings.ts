// Which listings the map shows. No map library in here: it takes plain numbers and returns plain pins.
import { useConvex } from 'convex/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../convex/_generated/api';
import { keepForKind, selectPins, townsInView, type Pin, type View } from '../components/results/pins';
import type { Listing, ListingKind, Recommendation } from '../components/listings/types';
import type { Filters, Weights } from '../types';
import { useRecommendedListings } from './listingsHooks';

export const RECOMMENDED_LIMIT = 60;
const SETTLE_MS = 250;

type Args = {
  kind: ListingKind; weights: Weights; filters: Filters;
  cities: readonly { id: string; lat: number; lng: number }[];
  /** Update on the map's moveend or zoomend, never per zoom frame. */
  view: View;
};

/**
 * Pins for the current view: recommended first (always), then forTown listings for towns in view at zoom >= 11, capped at 300.
 * `recommendations` is the same keep-previous list, so a list UI can share the one query (slice it for a short list).
 * One-shot forTown queries are cached per kind and town. Only listings.recommend and listings.forTown are called.
 */
export function useMapListings({ kind, weights, filters, cities, view }: Args): { pins: Pin[]; recommendations: Recommendation[] | undefined } {
  const convex = useConvex();
  // A slider drag sends one recommend query when it settles, not one per tick.
  const [settled, setSettled] = useState({ weights, filters });
  useEffect(() => {
    const t = setTimeout(() => setSettled({ weights, filters }), SETTLE_MS);
    return () => clearTimeout(t);
  }, [weights, filters]);
  const fresh = useRecommendedListings({ ...settled, kind, limit: RECOMMENDED_LIMIT });
  const last = useRef<{ kind: string; value: Recommendation[] }>();
  last.current = keepForKind(last.current, kind, fresh);
  const recommendations = last.current?.value;
  const recommended = useMemo(() => recommendations?.map(r => r.listing) ?? [], [recommendations]);

  const cache = useRef(new Map<string, Listing[]>());
  const [loaded, setLoaded] = useState(0);
  const towns = useMemo(() => townsInView(cities, view), [cities, view]);
  useEffect(() => {
    const forTown = (api as any).listings?.forTown;
    const missing = towns.filter(id => !cache.current.has(`${kind}:${id}`));
    if (!forTown || !missing.length) return;
    let live = true;
    Promise.all(missing.map(id => convex.query(forTown, { cityId: id, kind }).then((rows: Listing[]) => { cache.current.set(`${kind}:${id}`, rows); })))
      .then(() => { if (live) setLoaded(n => n + 1); })
      .catch(() => { /* a failed town is retried the next time the view changes */ });
    return () => { live = false; };
  }, [towns, kind, convex]);

  const pins = useMemo(() => {
    const nearby = towns.flatMap(id => cache.current.get(`${kind}:${id}`) ?? []);
    return selectPins(recommended, nearby, view);
    // loaded signals new cache entries
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommended, towns, kind, view, loaded]);

  return { pins, recommendations };
}
