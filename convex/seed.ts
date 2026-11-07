import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const replaceAll = mutation({
  args: {
    cities: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        county: v.string(),
        lat: v.number(),
        lng: v.number(),
        population: v.number(),
        blurb: v.string(),
      })
    ),
    metrics: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        category: v.string(),
        unit: v.string(),
        higherIsBetter: v.boolean(),
        description: v.string(),
        source: v.string(),
        sourceUrl: v.string(),
        year: v.number(),
        values: v.record(v.string(), v.number()),
      })
    ),
  },
  handler: async (ctx, { cities, metrics }) => {
    for (const t of ["cities", "metrics"] as const) {
      for (const doc of await ctx.db.query(t).collect()) await ctx.db.delete(doc._id);
    }
    for (const c of cities) await ctx.db.insert("cities", c);
    for (const m of metrics) await ctx.db.insert("metrics", m);
    return { cities: cities.length, metrics: metrics.length };
  },
});
