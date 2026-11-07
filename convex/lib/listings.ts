/** Shared, deterministic listings logic. Pure TS, no Convex imports (same rule as scoring.ts). */
import { rankTowns, type City, type Filters, type Metric, type Weights } from "./scoring";

export type ListingKind = "home" | "apartment";

export type Listing = {
  id: string;
  cityId: string;
  kind: ListingKind;
  name: string | null;
  address: string | null;
  lat: number;
  lng: number;
  value: number | null;
  rent: number | null;
  beds: number | null;
  sqft: number | null;
  yearBuilt: number | null;
  units: number | null;
  propertyType: string | null;
  source: string;
  sourceUrl: string;
};

export type Recommendation = {
  listing: Listing;
  cityId: string;
  townScore: number;
  townRank: number;
  reason: string;
};

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const priceOf = (listing: Listing): number | null => (listing.kind === "home" ? listing.value : listing.rent);

/**
 * Listings for one town, filtered by kind/budget and sorted by "fit": cheapest
 * first among listings that have a price, listings with no price (rare, source
 * gap) after those, ties broken by id for determinism.
 */
export function bestListingsForTown(
  listings: readonly Listing[],
  opts: { kind?: ListingKind; maxValue?: number; maxRent?: number; limit?: number } = {},
): Listing[] {
  const { kind, maxValue, maxRent, limit } = opts;
  const filtered = listings.filter((listing) => {
    if (kind && listing.kind !== kind) return false;
    if (listing.kind === "home" && finite(maxValue) && finite(listing.value) && listing.value > maxValue) return false;
    if (listing.kind === "apartment" && finite(maxRent) && finite(listing.rent) && listing.rent > maxRent) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => {
    const priceA = priceOf(a);
    const priceB = priceOf(b);
    if (finite(priceA) && finite(priceB)) return priceA - priceB;
    if (finite(priceA)) return -1;
    if (finite(priceB)) return 1;
    return a.id.localeCompare(b.id);
  });
  return finite(limit) ? sorted.slice(0, limit) : sorted;
}

/**
 * Ranks towns with the same scorer the UI uses, then picks the best-fitting
 * listings inside the top towns. For "home" listings, filters.maxHomeValue
 * doubles as the per-listing budget cap (the contract's Filters type has no
 * separate listings-only field). Apartments have no cap in Filters today, so
 * they're ordered by rent only; add filters.maxRent later if that's wanted.
 * Towns are exhausted in rank order before moving to the next, so a strong
 * match in your #1 town always outranks a cheaper listing in your #5 town.
 */
export function recommendListings(params: {
  cities: readonly City[];
  metrics: readonly Metric[];
  listings: readonly Listing[];
  weights: Weights;
  filters: Filters;
  kind: ListingKind;
  limit: number;
}): Recommendation[] {
  const { cities, metrics, listings, weights, filters, kind, limit } = params;
  const ranked = rankTowns(cities, metrics, weights, filters);
  const rankByCity = new Map(ranked.map((town, index) => [town.cityId, { rank: index + 1, score: town.score }]));
  const cityById = new Map(cities.map((city) => [city.id, city]));
  const cap = kind === "home" ? filters.maxHomeValue : undefined;

  const results: Recommendation[] = [];
  for (const town of ranked) {
    if (results.length >= limit) break;
    const info = rankByCity.get(town.cityId);
    if (!info) continue;
    const forTown = bestListingsForTown(
      listings.filter((listing) => listing.cityId === town.cityId),
      { kind, maxValue: cap, limit: limit - results.length },
    );
    for (const listing of forTown) {
      const cityName = cityById.get(town.cityId)?.name ?? town.cityId;
      results.push({
        listing,
        cityId: town.cityId,
        townScore: info.score,
        townRank: info.rank,
        reason: `#${info.rank} match for your priorities in ${cityName} (score ${Math.round(info.score)})`,
      });
      if (results.length >= limit) break;
    }
  }
  return results;
}
