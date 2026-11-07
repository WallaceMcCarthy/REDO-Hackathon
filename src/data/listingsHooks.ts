import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Listing, ListingKind, Recommendation } from '../../convex/lib/listings';
import type { Filters, Weights } from '../types';

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
