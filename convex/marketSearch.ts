import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { rankTowns } from "./lib/scoring";
import { withListingMetadata, type Listing, type Recommendation } from "./lib/listings";
import { searchListings, type ListingSearchOptions } from "./lib/listingSearch";
import { marketToListing, pricesWithinBudget } from "./lib/market";
import baselineMedians from "../data/listing-town-medians.json";

type Position = { n: number; price?: number; id?: string; year?: number };
type Cursor = { v: 1; key: string; turn: number; positions: Record<string, Position> };
type Entry = { listing: Listing; after: Position };
type Queue = { cityId: string; rank: number; score: number; name: string; count: number; position: Position; buffer: Entry[]; fallback: Listing[] | null; newest: { rcId: string; price: number; yearBuilt: number }[] };
export type MarketSearchOptions = ListingSearchOptions & { cursor?: string | null };
const priceOf = (row: Listing) => (row.kind === "home" ? row.value : row.rent) ?? Infinity;
const byPrice = (a: Listing, b: Listing) => priceOf(a) - priceOf(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const byNewest = (a: Listing, b: Listing) => (b.yearBuilt ?? -1) - (a.yearBuilt ?? -1) || byPrice(a, b);

/** Bounded index reads. No marketListings collect/offset scans, including deep pages. */
export async function indexedListingSearch(ctx: QueryCtx, opts: MarketSearchOptions) {
  const limit = opts.limit ?? 60;
  let offset = opts.cursor ? 0 : opts.offset ?? 0;
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
  // Existing clients remain usable before the first live snapshot has been loaded.
  if (!stats.some(row => row.prices.length)) {
    if (opts.cursor) {
      const parsed = JSON.parse(opts.cursor);
      if (!Number.isSafeInteger(parsed.legacyOffset) || parsed.legacyOffset < 0) throw new Error("Search changed; restart from the first page");
      offset = parsed.legacyOffset;
    }
    const legacy = await ctx.db.query("listings").take(4096);
    const result = searchListings({ cities, metrics, listings: legacy }, { ...opts, offset, limit });
    const nextCursor = result.hasMore ? JSON.stringify({ legacyOffset: result.nextOffset }) : null;
    return { ...result, nextCursor };
  }
  const key = JSON.stringify({ market, cap, sort, cityIds: opts.cityIds ? [...opts.cityIds].sort() : null,
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
    if (liveCount < 10) {
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
  if (sort === "fit") {
    for (const town of ranked) { const queue = await makeQueue(town); if (queue) queues.push(queue); if (queues.length === 8) break; }
  } else queues.push(...(await Promise.all(ranked.map(makeQueue))).filter((queue): queue is Queue => queue !== null));
  async function head(queue: Queue): Promise<Entry | undefined> {
    if (queue.position.n >= queue.count) return undefined;
    if (queue.fallback) return { listing: queue.fallback[queue.position.n], after: { n: queue.position.n + 1 } };
    if (!queue.buffer.length) {
      if (sort === "newest") {
        const start = queue.position.year ?? 0;
        for (const [i, entry] of queue.newest.slice(start, start + 3).entries()) {
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
      for (let i = 0; i < queues.length; i++) {
        const queue = queues[turn]; turn = (turn + 1) % queues.length;
        const candidate = await head(queue); if (candidate) { chosen = queue; entry = candidate; break; }
      }
    } else {
      const heads = await Promise.all(queues.map(async queue => ({ queue, entry: await head(queue) })));
      for (const candidate of heads) if (candidate.entry && (!entry || (sort === "newest" ? byNewest(candidate.entry.listing, entry.listing) : byPrice(candidate.entry.listing, entry.listing)) < 0)) { chosen = candidate.queue; entry = candidate.entry; }
    }
    if (!chosen || !entry) break;
    chosen.position = entry.after; if (!chosen.fallback) chosen.buffer.shift();
    if (skip) { skip--; continue; }
    page.push({ listing: entry.listing, cityId: chosen.cityId, townScore: chosen.score, townRank: chosen.rank,
      reason: `#${chosen.rank} match for your priorities ${entry.listing.market ? "near" : "in"} ${chosen.name} (score ${Math.round(chosen.score)})` });
  }
  const total = queues.reduce((sum, queue) => sum + queue.count, 0);
  const seen = queues.reduce((sum, queue) => sum + queue.position.n, 0);
  const hasMore = seen < total;
  const nextCursor = hasMore ? JSON.stringify({ v: 1, key, turn, positions: Object.fromEntries(queues.map(queue => [queue.cityId, queue.position])) } satisfies Cursor) : null;
  return { page, total, hasMore, nextOffset: hasMore ? seen : null, nextCursor, townMedians: baselineMedians };
}

/** Shared lookup for bookmarks/comments, with a public-data-only result. */
export async function findMarketListing(ctx: QueryCtx, id: string) {
  const match = /^market:(for_sale|for_rent):(.+)$/.exec(id);
  if (!match) return null;
  const market = match[1] as "for_sale" | "for_rent";
  const row = await ctx.db.query("marketListings").withIndex("by_market_rcId", q => q.eq("market", market).eq("rcId", match[2])).unique();
  return row && row.residential ? marketToListing(row) : null;
}
