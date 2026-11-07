import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

const listingValidator = v.object({
  id: v.string(),
  cityId: v.string(),
  kind: v.union(v.literal("home"), v.literal("apartment")),
  name: v.union(v.string(), v.null()),
  address: v.union(v.string(), v.null()),
  lat: v.number(),
  lng: v.number(),
  value: v.union(v.number(), v.null()),
  rent: v.union(v.number(), v.null()),
  beds: v.union(v.number(), v.null()),
  sqft: v.union(v.number(), v.null()),
  yearBuilt: v.union(v.number(), v.null()),
  units: v.union(v.number(), v.null()),
  propertyType: v.union(v.string(), v.null()),
  source: v.string(),
  sourceUrl: v.string(),
  year: v.union(v.number(), v.null()),
});

export const replaceAll = internalMutation({
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

/**
 * Loads listings in chunks (the CLI arg limit is ~1MB, so a 2MB file needs
 * several calls). Pass reset:true on the first chunk to clear old rows,
 * false on every chunk after so later chunks don't wipe earlier ones.
 */
/** Called in a loop: one mutation can read only 4096 rows, and listings have outgrown that. */
export const clearListings = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("listings").take(2000);
    for (const doc of rows) await ctx.db.delete(doc._id);
    return rows.length;
  },
});

export const replaceListings = internalMutation({
  args: {
    listings: v.array(listingValidator),
  },
  handler: async (ctx, { listings }) => {
    for (const l of listings) await ctx.db.insert("listings", l);
    return { inserted: listings.length };
  },
});
