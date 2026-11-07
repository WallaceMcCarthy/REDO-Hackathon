import { query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => ctx.db.query("cities").collect(),
});

export const get = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) =>
    ctx.db.query("cities").withIndex("by_cityId", (q) => q.eq("id", id)).unique(),
});
