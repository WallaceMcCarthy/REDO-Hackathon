import { v } from "convex/values";
import { query } from "./_generated/server";
import { rankTowns } from "./lib/scoring";

/** Rank the current source-backed datasets with the same scorer used by the UI. */
export const rank = query({
  args: {
    weights: v.record(v.string(), v.number()),
    filters: v.optional(v.object({
      maxHomeValue: v.optional(v.number()),
      maxCommuteMinutes: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    const [cities, metrics] = await Promise.all([
      ctx.db.query("cities").collect(),
      ctx.db.query("metrics").collect(),
    ]);
    return rankTowns(cities, metrics, args.weights, args.filters ?? {});
  },
});
