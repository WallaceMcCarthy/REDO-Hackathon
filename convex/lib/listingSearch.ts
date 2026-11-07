import { type Listing, type ListingKind, type Recommendation } from "./listings";
import { rankTowns, type City, type Filters, type Metric, type Weights } from "./scoring";

export type ListingSort = "fit" | "price_asc" | "newest";
export type ListingSearchOptions = {
  weights: Weights;
  filters?: Filters;
  kind: ListingKind;
  maxValue?: number;
  maxRent?: number;
  cityIds?: string[];
  sort?: ListingSort;
  offset?: number;
  limit?: number;
};

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const price = (l: Listing) => l.kind === "home" ? l.value : l.rent;
const numeric = (a: number | null, b: number | null, descending = false) => {
  if (!finite(a)) return finite(b) ? 1 : 0;
  if (!finite(b)) return -1;
  return descending ? b - a : a - b;
};
const median = (values: (number | null)[]) => {
  const sorted = values.filter(finite).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length ? (sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2) : null;
};

/** Medians describe the source sample, never current asking prices or a page. */
export function listingTownMedians(cities: readonly City[], listings: readonly Listing[]) {
  return cities.map(({ id: cityId }) => {
    const homes = listings.filter(l => l.cityId === cityId && l.kind === "home");
    const apartments = listings.filter(l => l.cityId === cityId && l.kind === "apartment");
    return { cityId, medianValue: median(homes.map(l => l.value)), medianRent: median(apartments.map(l => l.rent)), homeCount: homes.length, apartmentCount: apartments.length };
  });
}

/** Rank the complete eligible stream before slicing, so pages cannot reset diversity. */
export function searchListings(data: { cities: readonly City[]; metrics: readonly Metric[]; listings: readonly Listing[] }, opts: ListingSearchOptions) {
  const { cities, metrics, listings } = data;
  for (const [key, value] of Object.entries({ maxValue: opts.maxValue, maxRent: opts.maxRent })) {
    if (value !== undefined && (!finite(value) || value < 0)) throw new Error(`${key} must be a nonnegative finite number`);
  }
  const offset = opts.offset ?? 0;
  const limit = opts.limit ?? 60;
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("offset must be a nonnegative integer");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 300) throw new Error("limit must be an integer between 1 and 300");
  const sort = opts.sort ?? "fit";
  const selected = opts.cityIds === undefined ? null : new Set(opts.cityIds);
  // Normalize against all towns, then apply the town selection: selecting a town
  // must not alter its score or prevent a lower-ranked town from being browsed.
  const ranked = rankTowns(cities, metrics, opts.weights, opts.filters ?? {})
    .map((town, index) => ({ ...town, rank: index + 1 }))
    .filter(town => !selected || selected.has(town.cityId));
  const townById = new Map(ranked.map(t => [t.cityId, t]));
  const cityById = new Map(cities.map(c => [c.id, c]));
  const eligible = listings.filter(l => {
    if (l.kind !== opts.kind || !townById.has(l.cityId)) return false;
    const cap = l.kind === "home" ? opts.maxValue : opts.maxRent;
    return cap === undefined || (finite(price(l)) && price(l)! <= cap);
  });
  const wrap = (listing: Listing): Recommendation => {
    const town = townById.get(listing.cityId)!;
    return { listing, cityId: listing.cityId, townScore: town.score, townRank: town.rank,
      reason: `#${town.rank} match for your priorities in ${cityById.get(listing.cityId)?.name ?? listing.cityId} (score ${Math.round(town.score)})` };
  };
  const byPrice = (a: Listing, b: Listing) => numeric(price(a), price(b)) || a.id.localeCompare(b.id);
  let ordered: Listing[];
  if (sort === "fit") {
    // Skip towns without eligible inventory before choosing the top eight.
    const queues = ranked.map(t => eligible.filter(l => l.cityId === t.cityId).sort(byPrice)).filter(q => q.length).slice(0, 8);
    ordered = [];
    for (let i = 0; queues.some(q => i < q.length); i++) for (const queue of queues) if (queue[i]) ordered.push(queue[i]);
  } else {
    ordered = [...eligible].sort(sort === "newest"
      ? (a, b) => numeric(a.yearBuilt, b.yearBuilt, true) || byPrice(a, b)
      : byPrice);
  }
  const next = offset + limit;
  return { page: ordered.slice(offset, next).map(wrap), total: ordered.length,
    hasMore: next < ordered.length, nextOffset: next < ordered.length ? next : null,
    townMedians: listingTownMedians(cities, listings) };
}
