import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import type { MarketInput } from "./lib/market";

const modules = { "./listings.ts": () => import("./listings"), "./marketSearch.ts": () => import("./marketSearch"), "./seed.ts": () => import("./seed"), "./marketSeed.ts": () => import("./marketSeed"), "./social.ts": () => import("./social"), "./messages.ts": () => import("./messages"), "./_generated/server.js": () => import("./_generated/server.js") };
const search = makeFunctionReference<"query">("listings:search"), insert = makeFunctionReference<"mutation">("seed:insertMarketListings");
const base = { weights: { trails: 5 }, kind: "home" as const, limit: 3 };
const row = (id: string, fields: Partial<MarketInput> = {}): MarketInput => ({ rcId: id, market: "for_sale", address: `Fixture ${id}`, city: "Alpine", zip: null, lat: 40, lng: -111, price: 300000, beds: 3, baths: 2, sqft: 1500, yearBuilt: 2000, propertyType: "Single Family", listedDate: "2026-11-01", daysOnMarket: 6, ...fields });
async function setup() {
  const t = convexTest(schema, modules);
  await t.run(async ctx => {
    for (const [id, lat] of [["alpine", 40], ["desert", 37]] as const) await ctx.db.insert("cities", { id, name: id, county: "Test", lat, lng: -111, population: 100, blurb: "Fixture" });
    await ctx.db.insert("metrics", { id: "trails", label: "Trails", category: "outdoors", unit: "count", higherIsBetter: true, description: "Fixture", source: "Fixture", sourceUrl: "https://example.test", year: 2026, values: { alpine: 10, desert: 1 } });
  });
  return t;
}
const ids = (result: { page: { listing: { id: string } }[] }) => result.page.map(r => r.listing.id);

describe("indexed live listing search", () => {
  it("keeps counts identical across sorts while diversifying the first eight active towns", async () => {
    const t = await setup();
    const extra = Array.from({ length: 7 }, (_, i) => ({ id: `extra-${i}`, lat: 41 + i * 0.3 }));
    await t.run(async ctx => {
      for (const city of extra) await ctx.db.insert("cities", { ...city, name: city.id, county: "Test", lng: -111, population: 100, blurb: "Fixture" });
    });
    const places = [{ id: "alpine", lat: 40 }, { id: "desert", lat: 37 }, ...extra];
    await t.mutation(insert, { rows: places.flatMap(city => Array.from({ length: 12 }, (_, i) => row(`${city.id}-${i}`, { lat: city.lat }))) });
    const fit = await t.query(search, { ...base, limit: 8 });
    const price = await t.query(search, { ...base, sort: "price_asc", limit: 8 });
    expect(fit.total).toBe(108);
    expect(price.total).toBe(fit.total);
    expect(new Set(fit.page.map((r: { cityId: string }) => r.cityId)).size).toBe(8);
    const all = await t.query(search, { ...base, limit: 300 });
    expect(new Set(ids(all)).size).toBe(108);
    expect(new Set(all.page.map((r: { cityId: string }) => r.cityId)).size).toBe(9);
  });

  it("does not introduce estimates when a tighter budget crosses ten live matches", async () => {
    const t = await setup();
    await t.mutation(insert, { rows: Array.from({ length: 12 }, (_, i) => row(`live-${i}`, { price: 200 + i })) });
    await t.run(async ctx => {
      for (let i = 0; i < 40; i++) await ctx.db.insert("listings", { id: `legacy-${i}`, cityId: "alpine", kind: "home", name: null, address: "Fixture", lat: 40, lng: -111, value: 100, rent: null, beds: null, sqft: null, yearBuilt: null, units: null, propertyType: "Residential", source: "Assessor", sourceUrl: "https://example.test", year: 2025 });
    });
    const any = await t.query(search, { ...base, limit: 100 });
    const capped = await t.query(search, { ...base, maxValue: 205, limit: 100 });
    expect(any.total).toBe(12);
    expect(capped.total).toBe(6);
    expect(capped.page.every((r: { listing: { market?: string } }) => !!r.listing.market)).toBe(true);
  });

  it("prefers live inventory at ten matches and fills sparse towns with honest legacy records", async () => {
    const t = await setup();
    await t.mutation(insert, { rows: [...Array.from({ length: 12 }, (_, i) => row(`a-${i}`, { price: 300000 + i })), row("b-1", { lat: 37, price: 200000 }), row("land", { propertyType: "Land", price: 1 })] });
    await t.run(async ctx => {
      const legacy = { kind: "home" as const, name: null, address: "Legacy", lat: 40, lng: -111, value: 100000, rent: null, beds: null, sqft: null, yearBuilt: null, units: null, propertyType: "Residential", source: "Assessor", sourceUrl: "https://example.test", year: 2025 };
      await ctx.db.insert("listings", { ...legacy, id: "alpine-legacy", cityId: "alpine" });
      await ctx.db.insert("listings", { ...legacy, id: "desert-legacy", cityId: "desert", lat: 37 });
    });
    const result = await t.query(search, base);
    expect(result.total).toBe(14);
    expect(result.page.map((r: { cityId: string }) => r.cityId)).toEqual(["alpine", "desert", "alpine"]);
    expect(result.page[0].listing).toMatchObject({ market: "for_sale", priceKind: "asking_price", beds: 3, baths: 2 });
    const all = await t.query(search, { ...base, limit: 100 });
    expect(ids(all)).not.toContain("alpine-legacy");
    expect(ids(all)).toContain("desert-legacy");
    expect(ids(all).some(id => id.includes("land"))).toBe(false);
  });

  it("uses cursor pages across equal prices without duplicates or resetting round robin", async () => {
    const t = await setup();
    await t.mutation(insert, { rows: [...Array.from({ length: 25 }, (_, i) => row(`a-${String(i).padStart(2, "0")}`)), ...Array.from({ length: 25 }, (_, i) => row(`b-${String(i).padStart(2, "0")}`, { lat: 37 }))] });
    const first = await t.query(search, { ...base, limit: 7 });
    const second = await t.query(search, { ...base, limit: 7, cursor: first.nextCursor });
    const combined = [...ids(first), ...ids(second)];
    expect(new Set(combined).size).toBe(14);
    expect(second.page[0].cityId).toBe("desert");
    const all = await t.query(search, { ...base, limit: 100 });
    expect(combined).toEqual(ids(all).slice(0, 14));
    const offset = await t.query(search, { ...base, limit: 7, offset: 7 });
    expect(ids(offset)).toEqual(ids(second));
    await expect(t.query(search, { ...base, maxValue: 100, cursor: first.nextCursor })).rejects.toThrow("Search changed");
  });

  it("globally sorts budgeted prices and new construction across towns, retaining actual rental beds", async () => {
    const t = await setup();
    const rows = [...Array.from({ length: 10 }, (_, i) => row(`a-${i}`, { price: 100 + i, yearBuilt: 2000 + i })), ...Array.from({ length: 10 }, (_, i) => row(`b-${i}`, { lat: 37, price: 200 + i, yearBuilt: 2010 + i })), row("over-budget-new", { price: 1000, yearBuilt: 2026 }), row("rental", { market: "for_rent", price: 1500, beds: 4 })];
    await t.mutation(insert, { rows });
    const cheap = await t.query(search, { ...base, sort: "price_asc", maxValue: 205, limit: 100 });
    expect(cheap.total).toBe(16);
    expect(cheap.page.map((r: { listing: { value: number } }) => r.listing.value)).toEqual(Array.from({ length: 10 }, (_, i) => 100 + i).concat([200, 201, 202, 203, 204, 205]));
    const newest = await t.query(search, { ...base, sort: "newest", maxValue: 205 });
    expect(newest.page.map((r: { listing: { yearBuilt: number } }) => r.listing.yearBuilt)).toEqual([2015, 2014, 2013]);
    const rental = await t.query(search, { weights: {}, kind: "apartment", maxRent: 1500 });
    expect(rental.page[0].listing).toMatchObject({ rent: 1500, beds: 4, rentKind: "asking", priceKind: "asking_rent" });
    expect((await t.query(search, { ...base, cityIds: ["desert"] })).page.every((r: { cityId: string }) => r.cityId === "desert")).toBe(true);
  });

  it("resolves live listing ids for bookmarks, listing comments and private-message context", async () => {
    const t = await setup();
    await t.mutation(insert, { rows: [row("live-rental", { market: "for_rent", price: 1500, beds: 4 })] });
    const users = await t.run(async ctx => [await ctx.db.insert("users", {}), await ctx.db.insert("users", {})]);
    const alice = t.withIdentity({ subject: `${users[0]}|fixture` });
    const listingId = "market:for_rent:live-rental";
    expect(await alice.mutation(makeFunctionReference<"mutation">("social:toggleSaved"), { listingId })).toEqual({ saved: true });
    const saved = await alice.query(makeFunctionReference<"query">("social:mySaved"), {});
    expect(saved.page[0].listing).toMatchObject({ beds: 4, rentKind: "asking", sourceId: "live-rental" });
    await alice.mutation(makeFunctionReference<"mutation">("social:addComment"), { targetType: "listing", targetId: listingId, body: "Question about this live listing" });
    await alice.mutation(makeFunctionReference<"mutation">("messages:startConversation"), { otherUserId: users[1], listingId });
    const inbox = await alice.query(makeFunctionReference<"query">("messages:myConversations"), {});
    expect(inbox[0].listing.id).toBe(listingId);
  });
});
