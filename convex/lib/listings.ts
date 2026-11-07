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
  year: number | null;
  /** Derived at the API boundary; rent is never a quoted property asking rent. */
  rentKind?: "area_benchmark" | "asking" | null;
  rentBenchmarkBedrooms?: number | null;
  rentSourceUrl?: string | null;
  market?: "for_sale" | "for_rent";
  askingPrice?: number | null;
  baths?: number | null;
  listedDate?: string | null;
  daysOnMarket?: number | null;
  priceKind?: "asking_price" | "asking_rent";
  sourceId?: string;
  marketCity?: string | null;
  zip?: string | null;
};

/** Existing apartment source beds=2 means the benchmark size, not a unit attribute. */
export function withListingMetadata<T extends Listing>(listing: T) {
  return {
    ...listing,
    beds: listing.kind === "apartment" && !listing.market ? null : listing.beds,
    rentKind: listing.kind === "apartment" ? listing.market ? "asking" as const : "area_benchmark" as const : null,
    rentBenchmarkBedrooms: listing.kind === "apartment" && !listing.market ? 2 : null,
    rentSourceUrl: listing.kind === "apartment" ? listing.market ? listing.sourceUrl : "https://www.huduser.gov/portal/datasets/fmr.html#2025" : null,
  };
}

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
  return (finite(limit) ? sorted.slice(0, limit) : sorted).map(withListingMetadata);
}

/** How many of the top-ranked towns share the recommendation slots. */
const DIVERSITY_TOWNS = 8;

/**
 * Ranks towns with the same scorer the UI uses, then picks the best-fitting
 * listings spread across the top towns rather than draining the #1 town
 * first (that made every recommendation land in a single town, e.g. 60 Park
 * City homes for the skier persona). Takes the top DIVERSITY_TOWNS ranked
 * towns and interleaves round-robin: one listing per town per round, best
 * fit (cheapest within budget) first within each town, higher-ranked towns
 * going first each round so a strong #1-town match still surfaces before a
 * weaker #2-town one, but no single town can claim the whole limit. A town
 * with no listings (or fewer than its round-robin share) just contributes
 * less; its slots aren't redistributed to other towns past DIVERSITY_TOWNS.
 * For "home" listings, filters.maxHomeValue doubles as the per-listing
 * budget cap (the contract's Filters type has no separate listings-only
 * field). Apartments have no cap in Filters today, so they're ordered by
 * rent only; add filters.maxRent later if that's wanted.
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
  const ranked = rankTowns(cities, metrics, weights, filters).slice(0, DIVERSITY_TOWNS);
  const cityById = new Map(cities.map((city) => [city.id, city]));
  const cap = kind === "home" ? filters.maxHomeValue : undefined;

  const queues = ranked.map((town, index) => ({
    cityId: town.cityId,
    rank: index + 1,
    score: town.score,
    cityName: cityById.get(town.cityId)?.name ?? town.cityId,
    listings: bestListingsForTown(
      listings.filter((listing) => listing.cityId === town.cityId),
      { kind, maxValue: cap },
    ),
    next: 0,
  }));

  const results: Recommendation[] = [];
  let anyLeft = true;
  while (results.length < limit && anyLeft) {
    anyLeft = false;
    for (const queue of queues) {
      if (results.length >= limit) break;
      if (queue.next >= queue.listings.length) continue;
      anyLeft = true;
      const listing = queue.listings[queue.next++];
      results.push({
        listing,
        cityId: queue.cityId,
        townScore: queue.score,
        townRank: queue.rank,
        reason: `#${queue.rank} match for your priorities in ${queue.cityName} (score ${Math.round(queue.score)})`,
      });
    }
  }
  return results;
}
