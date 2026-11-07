import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { rankTowns } from "./lib/scoring";
import { withListingMetadata, type Listing, type Recommendation } from "./lib/listings";
import { listingTownMedians, type ListingSearchOptions } from "./lib/listingSearch";
import { marketToListing, pricesWithinBudget } from "./lib/market";
import baselineMedians from "../data/listing-town-medians.json";

type Position = { n: number; price?: number; id?: string; year?: number };
type Cursor = { v: 1; key: string; turn: number; positions: Record<string, Position> };
type Entry = { listing: Listing; after: Position };
type Queue = { cityId: string; rank: number | null; score: number | null; name: string; count: number; position: Position; buffer: Entry[]; fallback: Listing[] | null; newest: { rcId: string; price: number; yearBuilt: number }[]; exactOrder?: { rcId: string; price: number; yearBuilt: number }[] };
declare const process: { env: Record<string, string | undefined> };
export type MarketSearchOptions = ListingSearchOptions & { cursor?: string | null };
const priceOf = (row: Listing) => (row.kind === "home" ? row.value : row.rent) ?? Infinity;
const byPrice = (a: Listing, b: Listing) => priceOf(a) - priceOf(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const byNewest = (a: Listing, b: Listing) => (b.yearBuilt ?? -1) - (a.yearBuilt ?? -1) || byPrice(a, b);

/** Bounded index reads. No marketListings collect/offset scans, including deep pages. */
export async function indexedListingSearch(ctx: QueryCtx, opts: MarketSearchOptions) {
  const limit = opts.limit ?? 60;
  const offset = opts.cursor ? 0 : opts.offset ?? 0;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 300) throw new Error("limit must be an integer between1 and300");
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 3000) throw new Error("Use nextCursor for pages beyond offset3000");
  for (const value of [opts.maxValue, opts.maxRent]) if (value !== undefined && (!Number.isFinite(value) || value < 0)) throw new Error("Budget must be a nonnegative finite number");
  const market = opts.kind === "home" ? "for_sale" as const : "for_rent" as const;
  const cap = opts.kind === "home" ? opts.maxValue : opts.maxRent;
  const sort = opts.sort ?? "fit";
  const [cities, metrics, stats] = await Promise.all([
    ctx.db.query("cities").take(100), ctx.db.query("metrics").take(100),
    ctx.db.query("marketListingStats").withIndex("by_market", q => q.eq("market", market)).take(100),
  ]);
  const statewide = process.env.UTAH_STATEWIDE_ENABLED === 'true' && opts.cityIds === undefined
    && opts.filters?.maxHomeValue === undefined && opts.filters?.maxCommuteMinutes === undefined;
  const key = JSON.stringify({ market, cap, sort, statewide, cityIds: opts.cityIds ? [...opts.cityIds].sort() : null,
    filters: opts.filters ?? {}, weights: Object.fromEntries(Object.entries(opts.weights).sort(([a], [b]) => a.localeCompare(b))) });
  let cursor: Cursor = { v: 1, key, turn: 0, positions: {} };
  if (opts.cursor) {
    if (opts.cursor.length > 64000) throw new Error("Invalid search cursor");
    try { cursor = JSON.parse(opts.cursor); } catch { throw new Error("Invalid search cursor"); }
    if (cursor.v !== 1 || cursor.key !== key || !cursor.positions || !Number.isSafeInteger(cursor.turn) || cursor.turn < 0) throw new Error("Search changed; restart from the first page");
  }
  const selected = opts.cityIds === undefined ? null : new Set(opts.cityIds);
  const ranked = rankTowns(cities, metrics, opts.weights, opts.filters ?? {}).map((town, i) => ({ ...town, rank: i + 1 })).filter(town => !selected || selected.has(town.cityId));
  const cityById = new Map(cities.map(row => [row.id, row]));
  const statById = new Map(stats.map(row => [row.cityId, row]));
  let reads = cities.length + metrics.length + stats.length;
  const account = (n: number) => { reads += n; if (reads > 3950) throw new Error("This offset is too deep; reload and continue using nextCursor"); };
  async function marketPriceRows(cityId: string, position: Position, count: number) {
    if (cap === 0) return [];
    const prefix = () => ctx.db.query("marketListings").withIndex("by_city_market_residential_price", q => {
      const base = q.eq("cityId", cityId).eq("market", market).eq("residential", true).gte("price", 1);
      return cap === undefined ? base : base.lte("price", cap);
    });
    const rows: Doc<"marketListings">[] = [];
    if (position.price !== undefined && position.id) {
      if (!Number.isFinite(position.price) || position.price <= 0 || (cap !== undefined && position.price > cap)) throw new Error("Invalid price cursor");
      rows.push(...await ctx.db.query("marketListings").withIndex("by_city_market_residential_price", q => q.eq("cityId", cityId).eq("market", market).eq("residential", true).eq("price", position.price!).gt("rcId", position.id!)).take(count));
      if (rows.length < count) {
        const more = ctx.db.query("marketListings").withIndex("by_city_market_residential_price", q => {
          const base = q.eq("cityId", cityId).eq("market", market).eq("residential", true).gt("price", position.price!);
          return cap === undefined ? base : base.lte("price", cap);
        });
        rows.push(...await more.take(count - rows.length));
      }
    } else rows.push(...await prefix().take(count));
    account(rows.length); return rows;
  }
  async function makeQueue(town: typeof ranked[number]): Promise<Queue | null> {
    const stat = statById.get(town.cityId);
    const liveCount = pricesWithinBudget(stat?.prices ?? [], cap);
    let fallback: Listing[] | null = null;
    if ((stat?.prices.length ?? 0) < 10) {
      const legacy = cap === 0 ? [] : opts.kind === "home"
        ? await ctx.db.query("listings").withIndex("by_city_kind_value", q => {
          const base = q.eq("cityId", town.cityId).eq("kind", "home").gte("value", 1); return cap === undefined ? base : base.lte("value", cap);
        }).take(80)
        : await ctx.db.query("listings").withIndex("by_city_kind_rent", q => {
          const base = q.eq("cityId", town.cityId).eq("kind", "apartment").gte("rent", 1); return cap === undefined ? base : base.lte("rent", cap);
        }).take(80);
      account(legacy.length);
      const live = liveCount ? await marketPriceRows(town.cityId, { n: 0 }, 10) : [];
      fallback = [...live.flatMap(row => marketToListing(row) ?? []), ...legacy.map(withListingMetadata)];
      fallback.sort(sort === "newest" ? byNewest : sort === "price_asc" ? byPrice : (a, b) => Number(!!b.market) - Number(!!a.market) || byPrice(a, b));
    }
    const count = fallback ? fallback.length : liveCount;
    if (!count) return null;
    const position = cursor.positions[town.cityId] ?? { n: 0 };
    if (!Number.isSafeInteger(position.n) || position.n < 0 || position.n > count || (position.year !== undefined && (!Number.isSafeInteger(position.year) || position.year < 0))) throw new Error("Invalid search cursor position");
    if (!fallback && sort === "newest" && !stat?.yearOrder) throw new Error("Live listing sort index is rebuilding; choose Best fit briefly");
    return { cityId: town.cityId, rank: town.rank, score: town.score, name: cityById.get(town.cityId)?.name ?? town.cityId,
      count, position, fallback, buffer: [], newest: (stat?.yearOrder ?? []).filter(entry => cap === undefined || entry.price <= cap) };
  }
  const queues: Queue[] = [];
  queues.push(...(await Promise.all(ranked.map(makeQueue))).filter((queue): queue is Queue => queue !== null));
  if (statewide) {
    const stat = stats.find(s => s.cityId === null);
    const order = (stat?.yearOrder ?? []).filter(e => cap === undefined || e.price <= cap);
    if (sort !== 'newest') order.sort((a, b) => a.price - b.price || (a.rcId < b.rcId ? -1 : a.rcId > b.rcId ? 1 : 0));
    const position = cursor.positions[''] ?? { n: 0 };
    if (!Number.isSafeInteger(position.n) || position.n < 0 || position.n > order.length) throw new Error('Invalid statewide cursor');
    if (order.length) queues.push({ cityId: '', rank: null, score: null, name: 'Other Utah locations', count: order.length,
      position, buffer: [], fallback: null, newest: [], exactOrder: order });
  }
  async function head(queue: Queue): Promise<Entry | undefined> {
    if (queue.position.n >= queue.count) return undefined;
    if (queue.fallback) return { listing: queue.fallback[queue.position.n], after: { n: queue.position.n + 1 } };
    if (!queue.buffer.length) {
      if (sort === "newest" || queue.exactOrder) {
        const start = queue.exactOrder ? queue.position.n : queue.position.year ?? 0;
        for (const [i, entry] of (queue.exactOrder ?? queue.newest).slice(start, start + 3).entries()) {
          const row = await ctx.db.query("marketListings").withIndex("by_market_rcId", q => q.eq("market", market).eq("rcId", entry.rcId)).unique();
          account(row ? 1 : 0);
          const listing = row ? marketToListing(row) : null;
          if (listing) queue.buffer.push({ listing, after: { n: queue.position.n + i + 1, year: start + i + 1 } });
        }
      } else {
        const rows = await marketPriceRows(queue.cityId, queue.position, 3);
        for (const [i, row] of rows.entries()) {
          const listing = marketToListing(row);
          if (listing) queue.buffer.push({ listing, after: { n: queue.position.n + i + 1, price: row.price!, id: row.rcId } });
        }
      }
    }
    return queue.buffer[0];
  }
  let turn = cursor.turn % Math.max(1, queues.length), skip = offset;
  const page: Recommendation[] = [];
  while (page.length < limit) {
    let chosen: Queue | undefined, entry: Entry | undefined;
    if (sort === "fit") {
      const remaining = queues.map((queue, index) => ({ queue, index })).filter(({ queue }) => queue.position.n < queue.count);
      const rankedActive = remaining.filter(({ queue }) => queue.score !== null);
      const active = (rankedActive.length ? rankedActive : remaining).slice(0, 8);
      const next = active.find(({ index }) => index >= turn) ?? active[0];
      if (next) { chosen = next.queue; entry = await head(chosen); turn = (next.index + 1) % Math.max(1, queues.length); }
    } else {
      const heads = await Promise.all(queues.map(async queue => ({ queue, entry: await head(queue) })));
      for (const candidate of heads) if (candidate.entry && (!entry || (sort === "newest" ? byNewest(candidate.entry.listing, entry.listing) : byPrice(candidate.entry.listing, entry.listing)) < 0)) { chosen = candidate.queue; entry = candidate.entry; }
    }
    if (!chosen || !entry) break;
    chosen.position = entry.after; if (!chosen.fallback) chosen.buffer.shift();
    if (skip) { skip--; continue; }
    page.push({ listing: entry.listing, cityId: chosen.cityId, townScore: chosen.score, townRank: chosen.rank,
      reason: chosen.score === null ? 'No area score. This Utah location is outside our ranked town coverage.'
        : `${entry.listing.market ? "Near" : "In"} ${chosen.name}, your #${chosen.rank} area match (${Math.round(chosen.score)}/100)` });
  }
  const total = queues.reduce((sum, queue) => sum + queue.count, 0);
  const seen = queues.reduce((sum, queue) => sum + queue.position.n, 0);
  const hasMore = seen < total;
  const nextCursor = hasMore ? JSON.stringify({ v: 1, key, turn, positions: Object.fromEntries(queues.map(queue => [queue.cityId, queue.position])) } satisfies Cursor) : null;
  const known = new Map(baselineMedians.map(row => [row.cityId, row]));
  const townMedians = await Promise.all(cities.map(async city => {
    const baseline = known.get(city.id);
    if (baseline) return baseline;
    const [homes, apartments] = await Promise.all([
      ctx.db.query("listings").withIndex("by_city_kind_value", q => q.eq("cityId", city.id).eq("kind", "home")).take(80),
      ctx.db.query("listings").withIndex("by_city_kind_rent", q => q.eq("cityId", city.id).eq("kind", "apartment")).take(80),
    ]);
    return listingTownMedians([city], [...homes, ...apartments])[0];
  }));
  return { page, total, hasMore, nextOffset: hasMore ? seen : null, nextCursor, townMedians };
}

/** Shared lookup for bookmarks/comments, with a public-data-only result. */
export async function findMarketListing(ctx: QueryCtx, id: string) {
  const match = /^market:(for_sale|for_rent):(.+)$/.exec(id);
  if (!match) return null;
  const market = match[1] as "for_sale" | "for_rent";
  const row = await ctx.db.query("marketListings").withIndex("by_market_rcId", q => q.eq("market", market).eq("rcId", match[2])).unique();
  return row && row.residential ? marketToListing(row) : null;
}
