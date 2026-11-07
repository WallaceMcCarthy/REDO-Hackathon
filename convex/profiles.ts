import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getOptionalUserId, requireUserId } from "./lib/auth";

const MAX_DISPLAY_NAME = 40;
const MAX_BUDGET = 50_000_000;
const MAX_HOUSEHOLD = 20;

/** displayName is shown publicly (e.g. as a comment/post author), so it can't be empty or huge. */
function validateDisplayName(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_DISPLAY_NAME) {
    throw new Error(`Display name must be 1-${MAX_DISPLAY_NAME} characters`);
  }
  return trimmed;
}

function validateBudget(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > MAX_BUDGET) {
    throw new Error(`Budget must be a number between 0 and ${MAX_BUDGET}`);
  }
  return value;
}

function validateHousehold(value: number): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0 || value > MAX_HOUSEHOLD) {
    throw new Error(`Household size must be a whole number between 0 and ${MAX_HOUSEHOLD}`);
  }
  return value;
}

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
    const patch = {
      ...args,
      ...(args.displayName !== undefined ? { displayName: validateDisplayName(args.displayName) } : {}),
      ...(args.budget !== undefined && args.budget !== null ? { budget: validateBudget(args.budget) } : {}),
      ...(args.household !== undefined && args.household !== null ? { household: validateHousehold(args.household) } : {}),
    };
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    const user = await ctx.db.get(userId);
    return ctx.db.insert("profiles", {
      userId,
      displayName: patch.displayName ?? validateDisplayName(user?.email?.split("@")[0] ?? "New user"),
      cityId: patch.cityId ?? null,
      moveBy: patch.moveBy ?? null,
      budget: patch.budget ?? null,
      household: patch.household ?? null,
      isSample: false,
    });
  },
});
