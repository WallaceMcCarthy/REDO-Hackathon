import { internalMutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { marketRowValidator } from "./marketSchema";
import { normalizeMarketRow, type Market } from "./lib/market";

type OrderEntry = { rcId: string; price: number; yearBuilt: number };
type Delta = { cityId: string | null; market: Market; add: OrderEntry[]; remove: string[] };
function addDelta(changes: Map<string, Delta>, row: { cityId: string | null; market: Market; residential: boolean; price: number | null; rcId: string; sortYearBuilt: number }, remove: boolean) {
  if (!row.residential || row.price === null) return;
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
    const yearOrder = [...entries.values()].sort((a, b) => b.yearBuilt - a.yearBuilt || a.price - b.price || a.rcId.localeCompare(b.rcId));
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
