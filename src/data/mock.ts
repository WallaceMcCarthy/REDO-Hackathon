// DEV ONLY. Fake placeholder numbers so screens can be built before Convex lands.
// Delete this file when src/data/hooks.ts moves to Convex; CONTRACT.md forbids invented data in the demo.
import type { City, Filters, Metric, TownScore, Weights } from '../types';

export const mockCities: City[] = [
  ['salt-lake-city', 'Salt Lake City', 'Salt Lake', 40.7608, -111.891, 200000],
  ['provo', 'Provo', 'Utah', 40.2338, -111.6585, 115000],
  ['ogden', 'Ogden', 'Weber', 41.223, -111.9738, 87000],
  ['st-george', 'St. George', 'Washington', 37.0965, -113.5684, 95000],
  ['park-city', 'Park City', 'Summit', 40.6461, -111.498, 8000],
  ['moab', 'Moab', 'Grand', 38.5733, -109.5498, 5000],
  ['logan', 'Logan', 'Cache', 41.737, -111.8338, 52000],
  ['cedar-city', 'Cedar City', 'Iron', 37.6775, -113.0619, 35000],
  ['heber-city', 'Heber City', 'Wasatch', 40.507, -111.4132, 17000],
  ['sandy', 'Sandy', 'Salt Lake', 40.5649, -111.8389, 96000],
].map(([id, name, county, lat, lng, population]) => ({
  id, name, county, lat, lng, population, blurb: `MOCK blurb for ${name}.`,
} as City));

const fake = (seed: number) => Object.fromEntries(mockCities.map((c, i) => [c.id, ((i + 1) * seed * 7) % 97 + 3]));
const metric = (id: string, label: string, category: Metric['category'], unit: string, higherIsBetter: boolean, seed: number): Metric => ({
  id, label, category, unit, higherIsBetter, description: `MOCK description of ${label}.`,
  source: 'MOCK source', sourceUrl: 'https://example.com', year: 2025, values: fake(seed),
});

export const mockMetrics: Metric[] = [
  metric('home_value', 'Home value', 'cost', 'USD (mock)', false, 3),
  metric('crime_rate', 'Crime rate', 'safety', 'per 1k (mock)', false, 5),
  metric('air_quality', 'Air quality', 'environment', 'µg/m³ (mock)', false, 7),
  metric('ski_access', 'Ski access', 'outdoors', 'minutes (mock)', false, 11),
  metric('trails', 'Trails', 'outdoors', 'count (mock)', true, 13),
  metric('transit', 'Transit', 'transit', 'stops (mock)', true, 17),
  metric('restaurants_per_1k', 'Restaurants', 'culture', 'per 1k (mock)', true, 19),
  metric('universities', 'Universities', 'education', 'km (mock)', false, 23),
  metric('sports', 'Sports', 'community', 'km (mock)', false, 29),
];

export function mockRank(weights: Weights, filters: Filters): TownScore[] {
  const homes = mockMetrics[0].values;
  return mockCities
    .filter(c => filters.maxHomeValue === undefined || homes[c.id] <= filters.maxHomeValue)
    .map(c => {
      const breakdown = mockMetrics.map(m => {
        const raw = m.values[c.id];
        const normalized = m.higherIsBetter ? raw / 100 : 1 - raw / 100;
        const weight = weights[m.id] ?? 0;
        return { metricId: m.id, raw, normalized, weight, contribution: normalized * weight };
      });
      const total = breakdown.reduce((sum, b) => sum + b.weight, 0) || 1;
      const score = (breakdown.reduce((sum, b) => sum + b.contribution, 0) / total) * 100;
      return { cityId: c.id, score, breakdown, highlights: ['MOCK highlight'] };
    })
    .sort((a, b) => b.score - a.score);
}
