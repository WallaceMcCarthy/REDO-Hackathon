import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { assessorRowValidator } from "./assessorSchema";
import { assessorToListing, MAX_UPSERT_ROWS } from "./lib/assessor";

const MAX_PAGE = 100;

/** Cheapest first inside one town. Reads one index range per page, never the table. */
export const townHomes = query({
  args: { cityId: v.string(), maxValue: v.optional(v.number()), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { cityId, maxValue, paginationOpts }) => {
    const result = await ctx.db.query("assessorListings")
      .withIndex("by_city_value", q => maxValue === undefined ? q.eq("cityId", cityId) : q.eq("cityId", cityId).lte("value", maxValue))
      .paginate({ ...paginationOpts, numItems: Math.max(1, Math.min(paginationOpts.numItems, MAX_PAGE)) });
    return { ...result, page: result.page.map(assessorToListing) };
  },
});

/** Public-id lookup for saves, comments and messages. Ids match the `listings` home ids. */
export async function findAssessorListing(ctx: QueryCtx | MutationCtx, id: string) {
  const row = await ctx.db.query("assessorListings").withIndex("by_listingId", q => q.eq("id", id)).unique();
  return row && assessorToListing(row);
}

/** Retry-safe by parcel id: an identical row costs no write, so reruns converge. */
export const upsertListings = internalMutation({
  args: { rows: v.array(assessorRowValidator) },
  handler: async (ctx, { rows }) => {
    if (rows.length > MAX_UPSERT_ROWS) throw new Error(`Import at most ${MAX_UPSERT_ROWS} rows per call`);
    let inserted = 0, updated = 0, unchanged = 0;
    for (const row of rows) {
      const existing = await ctx.db.query("assessorListings").withIndex("by_listingId", q => q.eq("id", row.id)).unique();
      if (!existing) { await ctx.db.insert("assessorListings", row); inserted++; }
      else if (Object.entries(row).every(([key, value]) => existing[key as keyof typeof row] === value)) unchanged++;
      else { await ctx.db.replace(existing._id, row); updated++; }
    }
    return { inserted, updated, unchanged };
  },
});
