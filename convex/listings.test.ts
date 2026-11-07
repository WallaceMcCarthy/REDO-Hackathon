import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, it } from "vitest";
import schema from "./schema";

it("serves public search pages, real dataset medians, and rejects malformed requests", async () => {
  const t = convexTest(schema, {
    "./listings.ts": () => import("./listings"),
    "./_generated/server.js": () => import("./_generated/server.js"),
  });
  await t.run(async ctx => {
    await ctx.db.insert("cities", { id: "town", name: "Town", county: "Test", lat: 40, lng: -111, population: 100, blurb: "Fixture" });
    const base = { cityId: "town", name: null, address: null, lat: 40, lng: -111, value: null, rent: null, beds: null, sqft: null, yearBuilt: null, units: null, propertyType: null, source: "Fixture", sourceUrl: "https://example.com", year: 2026 };
    await ctx.db.insert("listings", { ...base, id: "h1", kind: "home", value: 300000 });
    await ctx.db.insert("listings", { ...base, id: "h2", kind: "home", value: 500000 });
    await ctx.db.insert("listings", { ...base, id: "a1", kind: "apartment", rent: 1500 });
    await ctx.db.insert("listings", { ...base, id: "a2", kind: "apartment", rent: 1700 });
  });
  const search = makeFunctionReference<"query">("listings:search");
  const first = await t.query(search, { weights: {}, kind: "apartment", maxRent: 1700, limit: 1 });
  expect(first).toMatchObject({ total: 2, hasMore: true, nextOffset: 1, townMedians: [{ cityId: "town", medianValue: 400000, medianRent: 1600, homeCount: 2, apartmentCount: 2 }] });
  expect(first.page[0].listing.id).toBe("a1");
  const last = await t.query(search, { weights: {}, kind: "apartment", maxRent: 1700, limit: 1, offset: first.nextOffset });
  expect(last).toMatchObject({ total: 2, hasMore: false, nextOffset: null });
  expect(last.page[0].listing.id).toBe("a2");
  const homes = await t.query(search, { weights: {}, kind: "home", maxValue: 350000 });
  expect(homes.page.map((x: { listing: { id: string } }) => x.listing.id)).toEqual(["h1"]);
  await expect(t.query(search, { weights: {}, kind: "home", limit: -1 })).rejects.toThrow();
  await expect(t.query(search, { weights: {}, kind: "home", sort: "untrusted" })).rejects.toThrow();
});
