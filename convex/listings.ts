import { v } from "convex/values";
import { query } from "./_generated/server";
import { bestListingsForTown, recommendListings, type Listing } from "./lib/listings";

/** Listings inside one town, sorted by fit (cheapest first within budget). */
export const forTown = query({
  args: {
    cityId: v.string(),
    kind: v.optional(v.union(v.literal("home"), v.literal("apartment"))),
    maxValue: v.optional(v.number()),
    maxRent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("listings")
      .withIndex("by_cityId", (q) => q.eq("cityId", args.cityId))
      .collect();
    return bestListingsForTown(rows as Listing[], {
      kind: args.kind,
      maxValue: args.maxValue,
      maxRent: args.maxRent,
    });
  },
});

/** Top listings across the towns that best fit the given weights/filters. */
export const recommend = query({
  args: {
    weights: v.record(v.string(), v.number()),
    filters: v.optional(
      v.object({
        maxHomeValue: v.optional(v.number()),
        maxCommuteMinutes: v.optional(v.number()),
      }),
    ),
    kind: v.union(v.literal("home"), v.literal("apartment")),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const [cities, metrics, listings] = await Promise.all([
      ctx.db.query("cities").collect(),
      ctx.db.query("metrics").collect(),
      ctx.db
        .query("listings")
        .withIndex("by_kind", (q) => q.eq("kind", args.kind))
        .collect(),
    ]);
    return recommendListings({
      cities,
      metrics,
      listings: listings as Listing[],
      weights: args.weights,
      filters: args.filters ?? {},
      kind: args.kind,
      limit: args.limit,
    });
  },
});
