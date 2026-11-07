export const CATEGORIES = ['cost', 'safety', 'environment', 'outdoors', 'transit', 'culture', 'education', 'community'] as const;
export type Category = (typeof CATEGORIES)[number];

export type City = {
  id: string;
  name: string;
  county: string;
  lat: number;
  lng: number;
  population: number;
  blurb: string;
};

export type Metric = {
  id: string;
  label: string;
  category: Category;
  unit: string;
  higherIsBetter: boolean;
  description: string;
  source: string;
  sourceUrl: string;
  year: number;
  values: Record<string, number>;
};

export type { Weights, Filters, TownScore } from '../convex/lib/scoring';
import type { Filters } from '../convex/lib/scoring';

export type CategoryWeights = Record<Category, number>;
/** What the person can spend on a home. Set only by the quiz. Never mirrored into filters, which are town-level caps. */
export type Budget = { maxValue?: number; maxRent?: number; mode?: 'buy' | 'rent' };
export type Prefs = { categories: CategoryWeights; filters: Filters; budget: Budget; personas?: string[] };
