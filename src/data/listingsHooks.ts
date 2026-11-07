import { useEffect, useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Listing, ListingKind, Recommendation } from '../../convex/lib/listings';
import type { Filters, Weights } from '../types';
import type { ListingSearchOptions } from '../../convex/lib/listingSearch';
import type { indexedListingSearch } from '../../convex/marketSearch';

type SearchResult = Awaited<ReturnType<typeof indexedListingSearch>>;

/** Accumulate server pages; a changed search starts a fresh stream immediately. */
export function useListingSearch(params: Omit<ListingSearchOptions, 'offset' | 'limit'>) {
  const key = JSON.stringify(params);
  const [cursor, setCursor] = useState<{ key: string; offset: number; value: string | null }>({ key, offset: 0, value: null });
  const offset = cursor.key === key ? cursor.offset : 0;
  const value = cursor.key === key ? cursor.value : null;
  const result = useQuery(api.listings.search, { ...params, cursor: value, limit: 60 });
  const [loaded, setLoaded] = useState<{ key: string; pages: Record<number, SearchResult> }>({ key, pages: {} });
  useEffect(() => {
    if (!result) return;
    setLoaded(previous => ({ key, pages: { ...(previous.key === key ? previous.pages : {}), [offset]: result } }));
  }, [result, key, offset]);
  const { items, last } = useMemo(() => {
    const pages = { ...(loaded.key === key ? loaded.pages : {}), ...(result ? { [offset]: result } : {}) };
    const ordered = Object.entries(pages).sort(([a], [b]) => Number(a) - Number(b));
    const seen = new Set<string>();
    const items = ordered.flatMap(([, page]) => page.page).filter(item => {
      if (seen.has(item.listing.id)) return false;
      seen.add(item.listing.id);
      return true;
    });
    return { items, last: ordered.at(-1)?.[1] };
  }, [loaded, key, result, offset]);
  return {
    items,
    total: last?.total ?? 0,
    loading: !last,
    fetching: result === undefined,
    hasMore: last?.hasMore ?? false,
    townMedians: last?.townMedians ?? [],
    loadMore: () => {
      if (result && last?.nextCursor != null) setCursor({ key, offset: last.nextOffset ?? offset + result.page.length, value: last.nextCursor });
    },
  };
}

/**
 * Recommendations query from Convex backend (api.listings.recommend).
 * Returns undefined while loading (Convex standard).
 */
export function useRecommendedListings(params: {
  weights: Weights;
  filters?: Filters;
  kind: ListingKind;
  limit: number;
}): Recommendation[] | undefined {
  const { weights, filters, kind, limit } = params;

  // Use (api as any).listings.recommend since _generated/api.d.ts may lag behind schema
  const queryFn = (api as any).listings?.recommend;
  const result = useQuery(
    queryFn,
    queryFn
      ? {
          weights,
          filters: filters ? { maxHomeValue: filters.maxHomeValue, maxCommuteMinutes: filters.maxCommuteMinutes } : undefined,
          kind,
          limit,
        }
      : 'skip',
  );

  return result as Recommendation[] | undefined;
}

/**
 * Fetch listings inside one town (api.listings.forTown).
 * Returns undefined while loading.
 */
export function useTownListings(params: {
  cityId: string;
  kind?: ListingKind;
  maxValue?: number;
  maxRent?: number;
}): Listing[] | undefined {
  const { cityId, kind, maxValue, maxRent } = params;

  const queryFn = (api as any).listings?.forTown;
  const result = useQuery(
    queryFn,
    queryFn
      ? {
          cityId,
          kind,
          maxValue,
          maxRent,
        }
      : 'skip',
  );

  return result as Listing[] | undefined;
}
