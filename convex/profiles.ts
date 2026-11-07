import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getOptionalUserId, requireUserId } from "./lib/auth";

/** The signed-in user's profile, or null if signed out or no profile row exists yet. */
export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    return {
      userId,
      email: user?.email ?? null,
      displayName: profile?.displayName ?? user?.email?.split("@")[0] ?? "New user",
      cityId: profile?.cityId ?? null,
      moveBy: profile?.moveBy ?? null,
      budget: profile?.budget ?? null,
      household: profile?.household ?? null,
    };
  },
});

/** Creates or updates the signed-in user's profile. Never trusts a client-sent user id. */
export const updateProfile = mutation({
  args: {
    displayName: v.optional(v.string()),
    cityId: v.optional(v.union(v.string(), v.null())),
    moveBy: v.optional(v.union(v.string(), v.null())),
    budget: v.optional(v.union(v.number(), v.null())),
    household: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }
    const user = await ctx.db.get(userId);
    return ctx.db.insert("profiles", {
      userId,
      displayName: args.displayName ?? user?.email?.split("@")[0] ?? "New user",
      cityId: args.cityId ?? null,
      moveBy: args.moveBy ?? null,
      budget: args.budget ?? null,
      household: args.household ?? null,
      isSample: false,
    });
  },
});
