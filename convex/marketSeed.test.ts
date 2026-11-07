import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, it } from "vitest";
import schema from "./schema";
import type { MarketInput } from "./lib/market";

const modules = { "./seed.ts": () => import("./seed"), "./marketSeed.ts": () => import("./marketSeed"), "./_generated/server.js": () => import("./_generated/server.js") };
const insert = makeFunctionReference<"mutation">("seed:insertMarketListings"), clear = makeFunctionReference<"mutation">("seed:clearMarketListingsBatch");
const row = (id: string, fields: Partial<MarketInput> = {}): MarketInput => ({ rcId: id, market: "for_sale", address: "Fixture", city: "Provo", zip: "84601", lat: 40.23, lng: -111.66, price: 300000, beds: 3, baths: 2, sqft: 1500, yearBuilt: 2000, propertyType: "Single Family", listedDate: "2026-11-01", daysOnMarket: 6, ...fields });
async function setup() {
  const t = convexTest(schema, modules);
  await t.run(ctx => ctx.db.insert("cities", { id: "provo", name: "Provo", county: "Utah", lat: 40.23, lng: -111.66, population: 100, blurb: "Fixture" }));
  return t;
}

it("imports both markets retry-safely and keeps exact priced-residential statistics on updates", async () => {
  const t = await setup();
  const rows = [row("same"), row("same", { market: "for_rent", price: 1800 }), row("land", { propertyType: "Land", price: 10000 }), row("unlocated", { lat: null, lng: null, price: null })];
  expect(await t.mutation(insert, { rows })).toMatchObject({ inserted: 4, updated: 0 });
  expect(await t.mutation(insert, { rows })).toMatchObject({ inserted: 0, updated: 4 });
  await t.mutation(insert, { rows: [row("same", { price: 350000 })] });
  const data = await t.run(async ctx => ({ rows: await ctx.db.query("marketListings").collect(), stats: await ctx.db.query("marketListingStats").collect() }));
  expect(data.rows).toHaveLength(4);
  expect(data.rows.find(r => r.rcId === "land")?.residential).toBe(false);
  expect(data.rows.find(r => r.rcId === "unlocated")?.cityId).toBeNull();
  expect(data.stats.find(s => s.cityId === "provo" && s.market === "for_sale")?.prices).toEqual([350000]);
  expect(data.stats.find(s => s.cityId === "provo" && s.market === "for_rent")?.prices).toEqual([1800]);
  await expect(t.mutation(insert, { rows: Array.from({ length: 401 }, (_, i) => row(String(i))) })).rejects.toThrow("400");
});

it("clears at most1000 rows per transaction and updates budget statistics", async () => {
  const t = await setup();
  for (const start of [0, 400, 800]) await t.mutation(insert, { rows: Array.from({ length: Math.min(400, 1050 - start) }, (_, i) => row(`fixture-${start + i}`)) });
  expect(await t.mutation(clear, {})).toEqual({ deleted: 1000, done: false });
  expect(await t.run(async ctx => (await ctx.db.query("marketListingStats").first())?.prices.length)).toBe(50);
  expect(await t.mutation(clear, {})).toEqual({ deleted: 50, done: true });
  expect(await t.run(async ctx => (await ctx.db.query("marketListingStats").first())?.prices)).toEqual([]);
});
