// Mirrors CONTRACT.md. Scoring types move to an import from convex/lib/scoring.ts once it lands.
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

export type Weights = Record<string, number>;
export type Filters = { maxHomeValue?: number; maxCommuteMinutes?: number };

export type TownScore = {
  cityId: string;
  score: number;
  breakdown: { metricId: string; raw: number; normalized: number; weight: number; contribution: number }[];
  highlights: string[];
};

export type CategoryWeights = Record<Category, number>;
export type Prefs = { categories: CategoryWeights; filters: Filters };
