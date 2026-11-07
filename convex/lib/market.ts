export type Market = "for_sale" | "for_rent";
export type MarketInput = {
  rcId: string; market: Market; address: string | null; city: string | null; zip: string | null;
  lat: number | null; lng: number | null; price: number | null; beds: number | null; baths: number | null;
  sqft: number | null; yearBuilt: number | null; propertyType: string | null; listedDate: string | null;
  daysOnMarket: number | null; cityId?: string | null;
};
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const residentialTypes = new Set(["single family", "single-family", "townhouse", "condo", "apartment", "manufactured", "multi-family"]);

export function nearestMarketTown(lat: number | null, lng: number | null, cities: readonly { id: string; lat: number; lng: number }[]) {
  if (!finite(lat) || !finite(lng)) return null;
  let best = 15, id: string | null = null;
  const rad = (n: number) => n * Math.PI / 180;
  for (const city of cities) {
    const a = Math.sin(rad(lat - city.lat) / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(city.lat)) * Math.sin(rad(lng - city.lng) / 2) ** 2;
    const distance = 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
    if (distance < best || (distance === best && (id === null || city.id < id))) { best = distance; id = city.id; }
  }
  return id;
}

export function normalizeMarketRow(row: MarketInput, cities: readonly { id: string; lat: number; lng: number }[], importedAt: number) {
  if (!row.rcId.trim() || row.rcId.length > 1000) throw new Error("A stable RentCast record id is required");
  if (row.lat !== null && (!finite(row.lat) || row.lat < -90 || row.lat > 90)) throw new Error("Invalid listing latitude");
  if (row.lng !== null && (!finite(row.lng) || row.lng < -180 || row.lng > 180)) throw new Error("Invalid listing longitude");
  const yearBuilt = finite(row.yearBuilt) && row.yearBuilt >= 1600 && row.yearBuilt <= new Date(importedAt).getUTCFullYear() + 1 ? Math.floor(row.yearBuilt) : null;
  return { ...row, rcId: row.rcId.trim(), price: finite(row.price) && row.price > 0 ? row.price : null,
    yearBuilt, cityId: nearestMarketTown(row.lat, row.lng, cities),
    residential: residentialTypes.has((row.propertyType ?? "").trim().toLowerCase()), sortYearBuilt: yearBuilt ?? -1, importedAt };
}

/** Exact inclusive budget counts without scanning market listing documents. */
export function pricesWithinBudget(sortedPrices: readonly number[], cap?: number) {
  if (cap === undefined) return sortedPrices.length;
  let low = 0, high = sortedPrices.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (sortedPrices[middle] <= cap) low = middle + 1; else high = middle;
  }
  return low;
}
