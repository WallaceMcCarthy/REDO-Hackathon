import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getOptionalUserId, requireUserId } from "./lib/auth";
import { canSeeContact, rankMatches, type Connection } from "./lib/roommates";
import { canRespond, planRequest, usersToExclude, validateProfile } from "./lib/roommateRules";

type Ctx = QueryCtx | MutationCtx;
type Profile = Doc<"roommateProfiles">;

const profileFields = {
  budgetMin: v.number(),
  budgetMax: v.number(),
  cityIds: v.array(v.string()),
  moveIn: v.number(),
  tags: v.array(v.string()),
  bio: v.string(),
  contact: v.string(),
};

const profileOf = (ctx: Ctx, userId: Id<"users">) =>
  ctx.db.query("roommateProfiles").withIndex("by_userId", (q) => q.eq("userId", userId)).unique();

/** Every connection row involving this user, either direction, any status. */
async function connectionsOf(ctx: Ctx, userId: Id<"users">) {
  const [out, inn] = await Promise.all([
    ctx.db.query("connections").withIndex("by_from", (q) => q.eq("fromUserId", userId)).collect(),
    ctx.db.query("connections").withIndex("by_to", (q) => q.eq("toUserId", userId)).collect(),
  ]);
  return [...out, ...inn];
}

/** The only shape other people ever see before acceptance. `contact` is deliberately absent. */
const publicView = (p: Profile) => ({
  profileId: p._id,
  budgetMin: p.budgetMin,
  budgetMax: p.budgetMax,
  cityIds: p.cityIds,
  moveIn: p.moveIn,
  tags: p.tags,
  bio: p.bio,
  isSample: p.isSample,
});

export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const me = await getOptionalUserId(ctx);
    if (!me) return null;
    const p = await profileOf(ctx, me);
    return p && { ...publicView(p), contact: p.contact, active: p.active };
  },
});

export const upsertMine = mutation({
  args: profileFields,
  handler: async (ctx, args) => {
    const me = await requireUserId(ctx);
    const towns = await Promise.all(args.cityIds.slice(0, 50).map((id) => ctx.db.query("cities").withIndex("by_cityId", (q) => q.eq("id", id)).unique()));
    const valid = new Set(towns.flatMap((t) => t?.id ?? []));
    const clean = validateProfile(args, valid);
    const existing = await profileOf(ctx, me);
    if (existing) await ctx.db.patch(existing._id, clean);
    else await ctx.db.insert("roommateProfiles", { ...clean, userId: me, active: true, isSample: false });
  },
});

export const setActive = mutation({
  args: { active: v.boolean() },
  handler: async (ctx, { active }) => {
    const me = await requireUserId(ctx);
    const p = await profileOf(ctx, me);
    if (!p) throw new ConvexError("Create a roommate profile first.");
    await ctx.db.patch(p._id, { active });
  },
});

export const deleteMine = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await requireUserId(ctx);
    for (const c of await connectionsOf(ctx, me)) await ctx.db.delete(c._id);
    const p = await profileOf(ctx, me);
    if (p) await ctx.db.delete(p._id);
  },
});

export const matches = query({
  args: {},
  handler: async (ctx) => {
    const me = await getOptionalUserId(ctx);
    if (!me) return [];
    const mine = await profileOf(ctx, me);
    if (!mine?.active) return [];
    const [active, conns] = await Promise.all([
      ctx.db.query("roommateProfiles").withIndex("by_active", (q) => q.eq("active", true)).collect(),
      connectionsOf(ctx, me),
    ]);
    const byUser = new Map(active.map((p) => [p.userId as string, p]));
    const ranked = rankMatches(mine, active, usersToExclude(me, conns));
    return ranked.map((m) => ({
      ...publicView(byUser.get(m.userId)!),
      score: m.score,
      sharedCityIds: m.sharedCityIds,
      sharedTags: m.sharedTags,
      reasons: m.reasons,
    }));
  },
});

export const sendRequest = mutation({
  args: { profileId: v.id("roommateProfiles") },
  handler: async (ctx, { profileId }) => {
    const me = await requireUserId(ctx);
    const mine = await profileOf(ctx, me);
    if (!mine?.active) throw new ConvexError("Turn on your roommate profile first.");
    const target = await ctx.db.get(profileId);
    if (!target?.active) throw new ConvexError("That profile is not available.");
    if (planRequest(me, target.userId, await connectionsOf(ctx, me)) === "create") {
      await ctx.db.insert("connections", { fromUserId: me, toUserId: target.userId, status: "pending" });
    }
    return "pending" as const; // same answer when a row exists, so a decline is never revealed
  },
});

export const respond = mutation({
  args: { connectionId: v.id("connections"), accept: v.boolean() },
  handler: async (ctx, { connectionId, accept }) => {
    const me = await requireUserId(ctx);
    const c = await ctx.db.get(connectionId);
    if (!c || !canRespond(me, c)) throw new ConvexError("Request not found.");
    await ctx.db.patch(connectionId, { status: accept ? "accepted" : "declined" });
  },
});

/** Incoming pending requests, with the sender's public profile only. */
export const listRequests = query({
  args: {},
  handler: async (ctx) => {
    const me = await getOptionalUserId(ctx);
    if (!me) return [];
    const rows = await ctx.db.query("connections").withIndex("by_to", (q) => q.eq("toUserId", me)).collect();
    const out = [];
    for (const c of rows.filter((r) => r.status === "pending")) {
      const p = await profileOf(ctx, c.fromUserId);
      if (p) out.push({ connectionId: c._id, ...publicView(p) });
    }
    return out;
  },
});

/** Accepted connections. Contact is included only when canSeeContact agrees. */
export const listConnections = query({
  args: {},
  handler: async (ctx) => {
    const me = await getOptionalUserId(ctx);
    if (!me) return [];
    const rows = await connectionsOf(ctx, me);
    const out = [];
    for (const c of rows.filter((r) => r.status === "accepted")) {
      const otherId = c.fromUserId === me ? c.toUserId : c.fromUserId;
      const p = await profileOf(ctx, otherId);
      if (p && canSeeContact(me, otherId, rows as Connection[])) out.push({ connectionId: c._id, ...publicView(p), contact: p.contact });
    }
    return out;
  },
});
