import { describe, expect, it } from "vitest";
import { bestListingsForTown, recommendListings, type Listing } from "./listings";
import type { City, Metric } from "./scoring";

const listing = (over: Partial<Listing> & Pick<Listing, "id" | "cityId" | "kind">): Listing => ({
  name: null,
  address: null,
  lat: 0,
  lng: 0,
  value: null,
  rent: null,
  beds: null,
  sqft: null,
  yearBuilt: null,
  units: null,
  propertyType: null,
  source: "Fixture",
  sourceUrl: "https://example.com",
  ...over,
});

describe("bestListingsForTown", () => {
  const listings: Listing[] = [
    listing({ id: "h1", cityId: "alpine", kind: "home", value: 400_000 }),
    listing({ id: "h2", cityId: "alpine", kind: "home", value: 250_000 }),
    listing({ id: "h3", cityId: "alpine", kind: "home", value: 900_000 }),
    listing({ id: "a1", cityId: "alpine", kind: "apartment", rent: 1500 }),
  ];

  it("sorts by price ascending within a kind", () => {
    const result = bestListingsForTown(listings, { kind: "home" });
    expect(result.map((l) => l.id)).toEqual(["h2", "h1", "h3"]);
  });

  it("filters out homes over the budget cap", () => {
    const result = bestListingsForTown(listings, { kind: "home", maxValue: 300_000 });
    expect(result.map((l) => l.id)).toEqual(["h2"]);
  });

  it("filters by kind and respects limit", () => {
    const result = bestListingsForTown(listings, { kind: "apartment", limit: 1 });
    expect(result.map((l) => l.id)).toEqual(["a1"]);
  });

  it("puts listings with no price last, ties broken by id", () => {
    const withGap: Listing[] = [
      listing({ id: "z", cityId: "alpine", kind: "home", value: null }),
      listing({ id: "y", cityId: "alpine", kind: "home", value: 100_000 }),
    ];
    expect(bestListingsForTown(withGap, { kind: "home" }).map((l) => l.id)).toEqual(["y", "z"]);
  });
});

describe("recommendListings", () => {
  const cities: City[] = ["alpine", "desert", "valley"].map((id) => ({
    id, name: id[0]!.toUpperCase() + id.slice(1), county: "Test", lat: 0, lng: 0, population: 100, blurb: "Fixture",
  }));
  const metric = (id: string, values: Record<string, number>, higherIsBetter = true): Metric => ({
    id, values, higherIsBetter, label: id, category: "cost", unit: "test",
    description: "Fixture", source: "Fixture", sourceUrl: "https://example.com", year: 2025,
  });
  const metrics = [
    metric("trails", { alpine: 30, desert: 10, valley: 20 }),
    // Present so the maxHomeValue cap below has town-level data to filter on
    // (rankTowns fails a town closed when a cap is set but it has no reading).
    metric("home_value", { alpine: 250_000, desert: 150_000, valley: 500_000 }, false),
  ];
  const listings: Listing[] = [
    listing({ id: "alpine-cheap", cityId: "alpine", kind: "home", value: 200_000 }),
    listing({ id: "alpine-pricey", cityId: "alpine", kind: "home", value: 800_000 }),
    listing({ id: "valley-mid", cityId: "valley", kind: "home", value: 400_000 }),
    listing({ id: "desert-cheap", cityId: "desert", kind: "home", value: 150_000 }),
  ];

  it("exhausts the top-ranked town's listings before moving to the next town", () => {
    const result = recommendListings({
      cities, metrics, listings, weights: { trails: 5 }, filters: {}, kind: "home", limit: 3,
    });
    // alpine ranks #1 for trails, so both its listings come first (cheapest first), then valley.
    expect(result.map((r) => r.listing.id)).toEqual(["alpine-cheap", "alpine-pricey", "valley-mid"]);
    expect(result[0].townRank).toBe(1);
    expect(result[0].reason).toContain("Alpine");
  });

  it("applies maxHomeValue as the per-listing budget cap for homes", () => {
    const result = recommendListings({
      cities, metrics, listings, weights: { trails: 5 }, filters: { maxHomeValue: 300_000 }, kind: "home", limit: 5,
    });
    expect(result.map((r) => r.listing.id)).toEqual(["alpine-cheap", "desert-cheap"]);
  });

  it("respects the overall limit across towns", () => {
    const result = recommendListings({
      cities, metrics, listings, weights: { trails: 5 }, filters: {}, kind: "home", limit: 1,
    });
    expect(result).toHaveLength(1);
    expect(result[0].listing.id).toBe("alpine-cheap");
  });
});
