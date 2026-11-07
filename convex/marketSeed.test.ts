import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, it } from "vitest";
import schema from "./schema";
import type { MarketInput } from "./lib/market";

const modules = { "./seed.ts": () => import("./seed"), "./marketSeed.ts": () => import("./marketSeed"), "./_generated/server.js": () => import("./_generated/server.js") };
const insert = makeFunctionReference<"mutation">("seed:insertMarketListings"), clear = makeFunctionReference<"mutation">("seed:clearMarketListingsBatch");
const purge = makeFunctionReference<'mutation'>('marketSeed:purgeNonUtahPage');
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

it('previews non-Utah evidence without changing rows, preserves rural Utah and updates exact statistics on deletion', async () => {
  const t = await setup();
  await t.mutation(insert, { rows: [row('utah'), row('rural-utah', { city: 'Richfield', zip: '84701', lat: 38.77, lng: -112.08 }),
    row('nevada', { address: '123 Main St, Ely, NV 89301', zip: '89301', lat: 39.25, lng: -114.88 }),
    row('missing-location', { lat: null, lng: null, zip: null }), row('wrong-zip', { zip: '82930' })] });
  // Simulate metadata written by the pre-geofence importer, including unavailable coordinates.
  await t.run(async ctx => {
    for (const rcId of ['nevada', 'wrong-zip', 'missing-location']) {
      const old = (await ctx.db.query('marketListings').withIndex('by_market_rcId', q => q.eq('market', 'for_sale').eq('rcId', rcId)).unique())!;
      await ctx.db.patch(old._id, { residential: true });
      const stat = (await ctx.db.query('marketListingStats').withIndex('by_city_market', q => q.eq('cityId', old.cityId).eq('market', old.market)).unique())!;
      await ctx.db.patch(stat._id, { prices: [...stat.prices, old.price!].sort((a, b) => a - b),
        yearOrder: [...(stat.yearOrder ?? []), { rcId, price: old.price!, yearBuilt: old.sortYearBuilt }] });
    }
  });
  const preview = await t.mutation(purge, {});
  expect(preview).toMatchObject({ dryRun: true, checked: 5, matched: 2, deleted: 0, isDone: true });
  expect(await t.run(ctx => ctx.db.query('marketListings').collect())).toHaveLength(5);
  expect(await t.run(async ctx => (await ctx.db.query('marketListingStats').collect()).reduce((n, s) => n + s.prices.length, 0))).toBe(5);
  expect(preview.examples.map((r: { rcId: string }) => r.rcId).sort()).toEqual(['nevada', 'wrong-zip']);
  const deleted = await t.mutation(purge, { dryRun: false });
  expect(deleted).toMatchObject({ matched: 2, deleted: 2 });
  const remaining = await t.run(async ctx => ({ rows: await ctx.db.query('marketListings').collect(), stats: await ctx.db.query('marketListingStats').collect() }));
  expect(remaining.rows.map(r => r.rcId).sort()).toEqual(['missing-location', 'rural-utah', 'utah']);
  expect(remaining.rows.find(r => r.rcId === 'rural-utah')?.cityId).toBeNull();
  expect(remaining.stats.reduce((n, r) => n + r.prices.length, 0)).toBe(2);
  expect(remaining.stats.flatMap(r => r.yearOrder ?? []).map(r => r.rcId).sort()).toEqual(['rural-utah', 'utah']);
  expect(await t.mutation(purge, { dryRun: false })).toMatchObject({ matched: 0, deleted: 0 });
});

it('keeps cursor pagination valid while deleting rows and caps each transaction', async () => {
  const t = await setup();
  await t.mutation(insert, { rows: Array.from({ length: 11 }, (_, i) => row(`bad-${i}`, { zip: '90210' })) });
  let cursor: string | null = null, deleted = 0, checked = 0;
  for (let pages = 0; pages < 10; pages++) {
    const r: { deleted: number; checked: number; isDone: boolean; continueCursor: string | null } = await t.mutation(purge, { cursor, dryRun: false, limit: 3 });
    deleted += r.deleted; checked += r.checked;
    if (r.isDone) break;
    cursor = r.continueCursor;
  }
  expect({ deleted, checked }).toEqual({ deleted: 11, checked: 11 });
  expect(await t.run(ctx => ctx.db.query('marketListings').collect())).toEqual([]);
  await expect(t.mutation(purge, { limit: 201 })).rejects.toThrow('200');
});
