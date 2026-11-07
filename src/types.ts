export type { Weights, Filters, TownScore } from "../convex/lib/scoring";

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
  category: string;
  unit: string;
  higherIsBetter: boolean;
  description: string;
  source: string;
  sourceUrl: string;
  year: number;
  values: Record<string, number>;
};
