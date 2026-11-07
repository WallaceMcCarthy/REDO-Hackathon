import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { marketRowValidator } from "./marketSchema";
import { normalizeMarketRow, type Market } from "./lib/market";
import { nonUtahReasons } from "./lib/utah";

type OrderEntry = { rcId: string; price: number; yearBuilt: number };
type Delta = { cityId: string | null; market: Market; add: OrderEntry[]; remove: string[] };
function addDelta(changes: Map<string, Delta>, row: { cityId: string | null; market: Market; residential: boolean; price: number | null; rcId: string; sortYearBuilt: number; lat: number | null; lng: number | null; address: string | null; zip: string | null }, remove: boolean) {
  if (!row.residential || row.price === null) return;
  if (!remove && (row.lat === null || row.lng === null || nonUtahReasons(row).length)) return;
  const key = JSON.stringify([row.cityId, row.market]);
  const delta = changes.get(key) ?? { cityId: row.cityId, market: row.market, add: [], remove: [] };
  if (remove) delta.remove.push(row.rcId);
  else delta.add.push({ rcId: row.rcId, price: row.price, yearBuilt: row.sortYearBuilt });
  changes.set(key, delta);
}
async function updateStats(ctx: MutationCtx, changes: Map<string, Delta>) {
  for (const delta of changes.values()) {
    const existing = await ctx.db.query("marketListingStats").withIndex("by_city_market", q => q.eq("cityId", delta.cityId).eq("market", delta.market)).unique();
    const entries = new Map((existing?.yearOrder ?? []).map(entry => [entry.rcId, entry]));
    for (const id of delta.remove) entries.delete(id);
    for (const entry of delta.add) entries.set(entry.rcId, entry);
    const yearOrder = [...entries.values()].sort((a, b) => b.yearBuilt - a.yearBuilt || a.price - b.price || (a.rcId < b.rcId ? -1 : a.rcId > b.rcId ? 1 : 0));
    const prices = yearOrder.map(entry => entry.price).sort((a, b) => a - b);
    const value = { cityId: delta.cityId, market: delta.market, prices, yearOrder, updatedAt: Date.now() };
    if (existing) await ctx.db.replace(existing._id, value); else await ctx.db.insert("marketListingStats", value);
  }
}

/** Admin import, no external API calls or credentials. Retry-safe per market+rcId. */
export const insertMarketListings = internalMutation({
  args: { rows: v.array(marketRowValidator) },
  handler: async (ctx, args) => {
    if (args.rows.length > 400) throw new Error("Import at most400 rows per call");
    const cities = await ctx.db.query("cities").take(100);
    if (!cities.length) throw new Error("Seed cities before importing live listings");
    const changes = new Map<string, Delta>();
    let inserted = 0, updated = 0;
    for (const input of args.rows) {
      const row = normalizeMarketRow(input, cities, Date.now());
      const existing = await ctx.db.query("marketListings").withIndex("by_market_rcId", q => q.eq("market", row.market).eq("rcId", row.rcId)).unique();
      if (existing) { addDelta(changes, existing, true); await ctx.db.replace(existing._id, row); updated++; }
      else { await ctx.db.insert("marketListings", row); inserted++; }
      addDelta(changes, row, false);
    }
    await updateStats(ctx, changes);
    return { inserted, updated, received: args.rows.length };
  },
});

export const clearMarketListingsBatch = internalMutation({
  args: {},
  handler: async ctx => {
    const rows = await ctx.db.query("marketListings").take(1000);
    const changes = new Map<string, Delta>();
    for (const row of rows) { addDelta(changes, row, true); await ctx.db.delete(row._id); }
    await updateStats(ctx, changes);
    return { deleted: rows.length, done: rows.length < 1000 };
  },
});

export const marketImportStatus = internalQuery({ args: {}, handler: async ctx => {
  const [rows, stats] = await Promise.all([ctx.db.query("marketListings").take(1), ctx.db.query("marketListingStats").take(100)]);
  return { hasRecords: rows.length > 0, exampleRcId: rows[0]?.rcId ?? null, pricedResidential: stats.reduce((sum, row) => sum + row.prices.length, 0),
    rankedPricedResidential: stats.filter(row => row.cityId !== null).reduce((sum, row) => sum + row.prices.length, 0),
    newestIndexReady: stats.every(row => row.yearOrder !== undefined), townsAndMarkets: stats.length };
} });

/** Operator-only, bounded and rerunnable. Preview is the default; null town IDs alone never qualify. */
export const purgeNonUtahPage = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())), dryRun: v.optional(v.boolean()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 200;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) throw new Error('Use a page size between 1 and 200.');
    const dryRun = args.dryRun !== false;
    const page = await ctx.db.query('marketListings').paginate({ cursor: args.cursor ?? null, numItems: limit });
    const affected = page.page.map(row => ({ row, reasons: nonUtahReasons(row) })).filter(x => x.reasons.length > 0);
    const changes = new Map<string, Delta>();
    if (!dryRun) {
      const rejected = new Set(affected.map(({ row }) => row._id));
      for (const row of page.page) {
        if (rejected.has(row._id)) {
          addDelta(changes, row, true);
          await ctx.db.delete(row._id);
        } else if (row.lat === null || row.lng === null) {
          // Keep unknown-location records, but do not count them as displayable map inventory.
          addDelta(changes, row, true);
        }
      }
      // Rebuild only affected keys; avoid repeatedly rewriting every town's compact index.
      await updateStats(ctx, changes);
    }
    return { dryRun, checked: page.page.length, matched: affected.length, deleted: dryRun ? 0 : affected.length,
      unlocatedPricedResidential: page.page.filter(r => r.residential && r.price !== null && (r.lat === null || r.lng === null)).length,
      eligibleOutsideTown: page.page.filter(r => r.cityId === null && r.residential && r.price !== null && r.lat !== null && r.lng !== null && nonUtahReasons(r).length === 0).length,
      isDone: page.isDone, continueCursor: page.isDone ? null : page.continueCursor,
      examples: affected.slice(0, 5).map(({ row, reasons }) => ({ rcId: row.rcId, market: row.market,
        address: row.address, zip: row.zip, lat: row.lat, lng: row.lng, cityId: row.cityId, reasons })) };
  },
});

/** Read-only check of the old assessor/HUD/OSM sample table. Never deletes shared social targets. */
export const auditLegacyUtahPage = internalQuery({
  args: { cursor: v.optional(v.union(v.string(), v.null())), table: v.optional(v.union(v.literal('listings'), v.literal('assessorListings'))) },
  handler: async (ctx, args) => {
    const table = args.table ?? 'listings';
    const page = await ctx.db.query(table).paginate({ cursor: args.cursor ?? null, numItems: 200 });
    const affected = page.page.map(row => ({ row, reasons: nonUtahReasons(row) })).filter(x => x.reasons.length > 0);
    return { table, checked: page.page.length, matched: affected.length, isDone: page.isDone,
      continueCursor: page.isDone ? null : page.continueCursor,
      examples: affected.slice(0, 5).map(({ row, reasons }) => ({ id: row.id, address: row.address, lat: row.lat, lng: row.lng, reasons })) };
  },
});
