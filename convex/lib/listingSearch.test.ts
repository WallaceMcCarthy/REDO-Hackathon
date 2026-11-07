import { describe, expect, it } from "vitest";
import { searchListings } from "./listingSearch";
import type { Listing } from "./listings";
import type { City, Metric } from "./scoring";

const cities: City[] = Array.from({ length: 10 }, (_, i) => ({ id: `town-${i}`, name: `Town ${i}`, county: "Test", lat: 0, lng: 0, population: 1, blurb: "" }));
const metrics: Metric[] = [{ id: "trails", label: "Trails", category: "outdoors", unit: "count", higherIsBetter: true, description: "", source: "Fixture", sourceUrl: "https://example.com", year: 2026, values: Object.fromEntries(cities.map((c, i) => [c.id, 10 - i])) }];
const listing = (id: string, cityId: string, fields: Partial<Listing> = {}): Listing => ({ id, cityId, kind: "home", name: null, address: null, lat: 0, lng: 0, value: 100, rent: null, beds: null, sqft: null, yearBuilt: null, units: null, propertyType: null, source: "Fixture", sourceUrl: "https://example.com", year: 2026, ...fields });
const listings = cities.flatMap((c, i) => [listing(`${c.id}-a`, c.id, { value: 100 + i, yearBuilt: 2000 + i }), listing(`${c.id}-b`, c.id, { value: 200 + i })]);
const data = { cities, metrics, listings };
const opts = { weights: { trails: 5 }, kind: "home" as const };
const ids = (r: ReturnType<typeof searchListings>) => r.page.map(x => x.listing.id);

describe("homes-first search", () => {
  it("pages the same diverse stream without resetting town queues", () => {
    const all = searchListings(data, opts);
    const first = searchListings(data, { ...opts, limit: 5 });
    const second = searchListings(data, { ...opts, limit: 5, offset: first.nextOffset! });
    expect(first.total).toBe(16);
    expect(first.hasMore).toBe(true);
    expect([...ids(first), ...ids(second)]).toEqual(ids(all).slice(0, 10));
    expect(new Set(all.page.slice(0, 8).map(x => x.cityId)).size).toBe(8);
    expect(searchListings(data, { ...opts, offset: 100 }).page).toEqual([]);
    expect(searchListings(data, { ...opts, offset: 100 }).nextOffset).toBeNull();
  });
  it("can browse a town outside the initial eight without renormalizing its score", () => {
    const selected = searchListings(data, { ...opts, cityIds: ["town-9"] });
    expect(selected.total).toBe(2);
    expect(selected.page[0].townScore).toBe(0);
    expect(selected.page[0].townRank).toBe(10);
    expect(selected.page[0].reason).toContain("Town 9");
    expect(searchListings(data, { ...opts, cityIds: [] }).total).toBe(0);
    expect(searchListings(data, { ...opts, cityIds: ["missing"] }).total).toBe(0);
  });
  it("applies inclusive actual home and rent budgets and excludes unknown prices", () => {
    const d = { ...data, listings: [listing("known", "town-0"), listing("unknown", "town-0", { value: null }), listing("rent", "town-0", { kind: "apartment", value: null, rent: 1500 }), listing("rent-gap", "town-0", { kind: "apartment", rent: null })] };
    expect(ids(searchListings(d, { ...opts, maxValue: 100 }))).toEqual(["known"]);
    const apartments = searchListings(d, { ...opts, kind: "apartment", maxRent: 1500 });
    expect(ids(apartments)).toEqual(["rent"]);
    expect(apartments.page[0].listing).toMatchObject({ rentKind: "area_benchmark", rentBenchmarkBedrooms: 2, beds: null });
    expect(searchListings(d, { ...opts, kind: "apartment", maxRent: 1499 }).total).toBe(0);
    expect(searchListings(d, { ...opts, maxValue: 0 }).total).toBe(0);
  });
  it("uses later towns when high-ranked towns have no inventory within budget", () => {
    const d = { ...data, listings: listings.map(l => l.cityId === "town-0" ? { ...l, value: 999 } : l) };
    const r = searchListings(d, { ...opts, maxValue: 110 });
    expect(r.page.map(x => x.cityId)).toEqual(cities.slice(1, 9).map(c => c.id));
  });
  it("sorts the entire eligible inventory by price or year built with unknowns last", () => {
    const d = { ...data, listings: [listing("z", "town-0", { value: null }), listing("b", "town-9", { value: 50, yearBuilt: 2024 }), listing("a", "town-0", { value: 50, yearBuilt: 2024 }), listing("old", "town-1", { value: 20, yearBuilt: 1900 })] };
    expect(ids(searchListings(d, { ...opts, sort: "price_asc" }))).toEqual(["old", "a", "b", "z"]);
    expect(ids(searchListings(d, { ...opts, sort: "newest" }))).toEqual(["a", "b", "old", "z"]);
  });
  it("returns sample medians and zero-coverage towns independent of filters and paging", () => {
    const d = { ...data, listings: [listing("h1", "town-0", { value: 100 }), listing("h2", "town-0", { value: 300 }), listing("h3", "town-0", { value: null }), listing("apt", "town-0", { kind: "apartment", rent: 1500 })] };
    const r = searchListings(d, { ...opts, cityIds: ["town-9"], maxValue: 0 });
    expect(r.townMedians[0]).toEqual({ cityId: "town-0", medianValue: 200, medianRent: 1500, homeCount: 3, apartmentCount: 1 });
    expect(r.townMedians[9]).toEqual({ cityId: "town-9", medianValue: null, medianRent: null, homeCount: 0, apartmentCount: 0 });
  });
  it("rejects invalid paging and caps rather than returning misleading matches", () => {
    for (const fields of [{ offset: -1 }, { offset: 0.5 }, { limit: 0 }, { limit: 301 }, { limit: NaN }, { maxValue: -1 }, { maxRent: Infinity }]) expect(() => searchListings(data, { ...opts, ...fields })).toThrow();
  });
});
