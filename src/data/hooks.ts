// The only file that knows where data comes from. Screens import these hooks and nothing else.
// undefined means still loading, matching Convex useQuery.
import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { rankTowns } from '../../convex/lib/scoring';
import type { City, Filters, Metric, TownScore, Weights } from '../types';

export const useCities = (): City[] | undefined => useQuery(api.cities.list);
export const useMetrics = (): Metric[] | undefined => useQuery(api.metrics.list) as Metric[] | undefined;

// Ranks in the browser with the shared scorer: a server round trip per slider tick would flicker.
export function useRank(weights: Weights, filters: Filters): TownScore[] | undefined {
  const cities = useCities();
  const metrics = useMetrics();
  return useMemo(
    () => (cities && metrics ? rankTowns(cities, metrics, weights, filters) : undefined),
    [cities, metrics, weights, filters],
  );
}
