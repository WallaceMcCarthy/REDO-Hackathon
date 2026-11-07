// The only file that knows where data comes from. Screens import these hooks and nothing else.
// undefined means still loading, matching Convex useQuery.
import { mockCities, mockMetrics, mockRank } from './mock';
import type { City, Filters, Metric, TownScore, Weights } from '../types';

export const USING_MOCK_DATA = true;

export const useCities = (): City[] | undefined => mockCities;
export const useMetrics = (): Metric[] | undefined => mockMetrics;
export const useRank = (weights: Weights, filters: Filters): TownScore[] | undefined => mockRank(weights, filters);
