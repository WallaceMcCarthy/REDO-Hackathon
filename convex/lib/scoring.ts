/** Shared, deterministic ranking logic. Safe to import in both React and Convex. */
export type Weights = Record<string, number>;
export type Filters = { maxHomeValue?: number; maxCommuteMinutes?: number };
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
export type TownScore = {
  cityId: string;
  score: number;
  breakdown: {
    metricId: string;
    raw: number;
    normalized: number;
    weight: number;
    contribution: number;
  }[];
  highlights: string[];
};

export const PERSONA_WEIGHTS = {
  skier: { ski_access: 5, trails: 4, air_quality: 3, home_value: 2, national_parks: 2 },
  family: { crime_rate: 5, home_value: 4, air_quality: 4, water_quality: 3, median_income: 3, universities: 2, noise: 2 },
  remote_worker: { median_rent: 5, home_value: 4, air_quality: 4, trails: 3, restaurants_per_1k: 3, noise: 2 },
  foodie: { restaurants_per_1k: 5, venues: 4, transit: 3, median_rent: 2 },
  retiree: { crime_rate: 5, air_quality: 5, water_quality: 4, home_value: 3, noise: 3, national_parks: 2 },
  student: { median_rent: 5, universities: 5, transit: 4, venues: 3, restaurants_per_1k: 2, sports: 2 },
} satisfies Record<string, Weights>;

export type PersonaId = keyof typeof PERSONA_WEIGHTS;
export const PERSONAS: Record<PersonaId, { label: string; description: string; weights: Weights }> = {
  skier: { label: "Skier", description: "Ski access, trails, and clean mountain air.", weights: PERSONA_WEIGHTS.skier },
  family: { label: "Family", description: "Safety, affordable homes, and a healthy environment.", weights: PERSONA_WEIGHTS.family },
  remote_worker: { label: "Remote worker", description: "Affordable living with trails and places to unwind.", weights: PERSONA_WEIGHTS.remote_worker },
  foodie: { label: "Foodie", description: "Restaurants, cultural venues, and transit.", weights: PERSONA_WEIGHTS.foodie },
  retiree: { label: "Retiree", description: "Safety, clean air and water, and peaceful living.", weights: PERSONA_WEIGHTS.retiree },
  student: { label: "Student", description: "Affordable rent, campus access, and things to do.", weights: PERSONA_WEIGHTS.student },
};

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/**
 * Min/max normalization uses all candidate towns BEFORE filters, so applying a
 * budget does not change an individual town's score. Constant metrics are neutral.
 * Missing measurements are also neutral (0.5), but omitted from the breakdown
 * because there is no raw value to cite. Their uncertainty appears in highlights.
 * Contributions are percentage points and sum to the unrounded total when all
 * selected measurements are present. Unselected/unavailable metrics are ignored.
 */
export function rankTowns(
  cities: readonly City[],
  metrics: readonly Metric[],
  weights: Weights,
  filters: Filters = {},
): TownScore[] {
  const cityIds = new Set(cities.map((city) => city.id));
  const selected = metrics.flatMap((metric) => {
    const requested = weights[metric.id];
    const weight = finite(requested) ? Math.min(5, Math.max(0, requested)) : 0;
    if (weight === 0) return [];
    const values = Object.entries(metric.values)
      .filter(([id, value]) => cityIds.has(id) && finite(value))
      .map(([, value]) => value);
    if (values.length === 0) return [];
    return [{ metric, weight, min: Math.min(...values), max: Math.max(...values) }];
  });
  const totalWeight = selected.reduce((sum, item) => sum + item.weight, 0);
  const homeValues = metrics.find((metric) => metric.id === "home_value")?.values;
  // Commute remains optional: with no dataset, an active cap fails closed.
  const commuteValues = metrics.find((metric) => metric.id === "commute_minutes")?.values;
  const passesCap = (cap: number | undefined, raw: unknown) =>
    !finite(cap) || (finite(raw) && raw <= cap);

  return cities
    .filter((city) =>
      passesCap(filters.maxHomeValue, homeValues?.[city.id]) &&
      passesCap(filters.maxCommuteMinutes, commuteValues?.[city.id]),
    )
    .map((city): TownScore => {
      let points = 0;
      let missingCount = 0;
      const highlights: string[] = [];
      const rankedHighlights: { text: string; importance: number }[] = [];
      const breakdown: TownScore["breakdown"] = [];
      for (const { metric, weight, min, max } of selected) {
        const raw = metric.values[city.id];
        if (!finite(raw)) {
          points += 0.5 * weight / totalWeight * 100;
          missingCount += 1;
          continue;
        }
        const position = max === min ? 0.5 : (raw - min) / (max - min);
        const normalized = metric.higherIsBetter ? position : 1 - position;
        const contribution = normalized * weight / totalWeight * 100;
        points += contribution;
        breakdown.push({ metricId: metric.id, raw, normalized, weight, contribution });
        if (max !== min && normalized >= 0.5) {
          let betterCount = 0;
          let tiedCount = 0;
          for (const candidate of cities) {
            const other = metric.values[candidate.id];
            if (!finite(other)) continue;
            if (other === raw) tiedCount += 1;
            else if (metric.higherIsBetter ? other > raw : other < raw) betterCount += 1;
          }
          // A badge should distinguish at most three towns, including all ties.
          // Near-universal zero-violations values do not distinguish towns.
          if (betterCount + tiedCount <= 3) {
            rankedHighlights.push({
              text: betterCount === 0 && tiedCount === 1 ? `Best for ${metric.label.toLowerCase()}` : `Top 3 for ${metric.label.toLowerCase()}`,
              importance: weight * normalized,
            });
          }
        }
      }
      highlights.push(...rankedHighlights.sort((a, b) => b.importance - a.importance || a.text.localeCompare(b.text)).slice(0, 3).map((item) => item.text));
      if (missingCount > 0) highlights.push(`${missingCount} selected ${missingCount === 1 ? "measurement is" : "measurements are"} unavailable; scored neutrally`);
      if (totalWeight === 0) highlights.push("Choose your priorities to personalize this ranking");
      return { cityId: city.id, score: totalWeight === 0 ? 50 : Math.round(points * 100) / 100, breakdown, highlights };
    })
    .sort((a, b) => b.score - a.score || a.cityId.localeCompare(b.cityId));
}
