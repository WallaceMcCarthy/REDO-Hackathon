import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { nextLikes } from "./lib/feed";
import { deletePostBatch } from "./posts";
import { deleteCommentBatch } from "./social";

/** Rows one sweep run may touch, far below Convex's per-mutation read and write limits. */
const BATCH = 200;

/** Handles up to BATCH rows still tied to the user and returns the count, 0 once none remain. */
type Step = (ctx: MutationCtx, userId: Id<"users">) => Promise<number>;

async function deleteRows(ctx: MutationCtx, rows: { _id: Id<TableNames> }[]) {
  for (const row of rows) await ctx.db.delete(row._id);
  return rows.length;
}

/** Spends the batch on one owned row at a time, for rows whose cascades may span several runs. */
async function spendBatch<T>(next: () => Promise<T | null>, deleteSome: (row: T, limit: number) => Promise<number>) {
  let left = BATCH;
  for (let row = await next(); row && left > 0; row = await next()) left -= await deleteSome(row, left);
  return BATCH - left;
}

const sessions: Step = (ctx, userId) =>
  spendBatch(
    () => ctx.db.query("authSessions").withIndex("userId", (q) => q.eq("userId", userId)).first(),
    async (session, limit) => {
      const tokens = await ctx.db.query("authRefreshTokens").withIndex("sessionId", (q) => q.eq("sessionId", session._id)).take(limit);
      await deleteRows(ctx, tokens);
      if (tokens.length === limit) return limit;
      await ctx.db.delete(session._id);
      return tokens.length + 1;
    },
  );

/**
 * Campaigns are anonymized, never deleted: payments reference them, and a webhook for a checkout
 * started before deletion must still find its row. Kind, dates, amounts and counters stay for accounting.
 */
const campaigns: Step = async (ctx, userId) => {
  const rows = await ctx.db.query("campaigns").withIndex("by_advertiser", (q) => q.eq("advertiserUserId", userId)).take(BATCH);
  const now = Date.now();
  for (const row of rows) {
    await ctx.db.patch(row._id, {
      advertiserUserId: undefined,
      title: "Deleted advertiser",
      body: "",
      url: "",
      lat: undefined,
      lng: undefined,
      listingId: undefined,
      cityId: undefined,
      status: "expired",
      endsAt: Math.min(row.endsAt, now),
    });
  }
  return rows.length;
};

const posts: Step = (ctx, userId) =>
  spendBatch(
    () => ctx.db.query("posts").withIndex("by_userId", (q) => q.eq("userId", userId)).first(),
    (post, limit) => deletePostBatch(ctx, post, limit),
  );

const comments: Step = (ctx, userId) =>
  spendBatch(
    () => ctx.db.query("comments").withIndex("by_user", (q) => q.eq("userId", userId)).first(),
    (comment, limit) => deleteCommentBatch(ctx, comment, limit),
  );

const likes: Step = async (ctx, userId) => {
  const rows = await ctx.db.query("postLikes").withIndex("by_user", (q) => q.eq("userId", userId)).take(BATCH);
  for (const like of rows) {
    const post = await ctx.db.get(like.postId);
    if (post) await ctx.db.patch(post._id, { likes: nextLikes(post.likes, true) });
    await ctx.db.delete(like._id);
  }
  return rows.length;
};

/** Lowers counts so re-registering can't stack reports, but leaves `hidden` alone: leaving must not restore moderated content. */
async function withdrawReport(ctx: MutationCtx, report: Doc<"contentReports">) {
  const id = report.targetType === "post" ? ctx.db.normalizeId("posts", report.targetId) : ctx.db.normalizeId("comments", report.targetId);
  const target = id && (await ctx.db.get(id));
  if (target) await ctx.db.patch(target._id, { reports: Math.max(0, target.reports - 1) });
  await ctx.db.delete(report._id);
}

const reports: Step = async (ctx, userId) => {
  const rows = await ctx.db.query("contentReports").withIndex("by_user", (q) => q.eq("userId", userId)).take(BATCH);
  for (const report of rows) await withdrawReport(ctx, report);
  return rows.length;
};

const saved: Step = async (ctx, userId) =>
  deleteRows(ctx, await ctx.db.query("saved").withIndex("by_user", (q) => q.eq("userId", userId)).take(BATCH));

const connections: Step = async (ctx, userId) =>
  (await deleteRows(ctx, await ctx.db.query("connections").withIndex("by_from", (q) => q.eq("fromUserId", userId)).take(BATCH))) ||
  deleteRows(ctx, await ctx.db.query("connections").withIndex("by_to", (q) => q.eq("toUserId", userId)).take(BATCH));

const steps: Step[] = [sessions, campaigns, posts, comments, likes, reports, saved, connections];

/**
 * One bounded slice per run, rescheduled until every step finds nothing. It keeps no cursor, so
 * re-running it after a failure, or alongside another run, converges on the same end state:
 * `npx convex run account:sweep '{"userId":"..."}'`.
 */
export const sweep = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<void> => {
    for (const step of steps) {
      if ((await step(ctx, userId)) > 0) {
        await ctx.scheduler.runAfter(0, internal.account.sweep, { userId });
        return;
      }
    }
  },
});

/**
 * Everything small and identifying goes in this one transaction, so the account is gone the moment
 * it commits: open JWTs fail requireUserId, the email is free, and the sweep is guaranteed to start.
 * A repeat call is rejected as signed out and changes nothing.
 */
export const deleteMyAccount = mutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    const userId = await requireUserId(ctx);
    // One row per provider. Codes and rate limits are keyed by account, so they can't wait for the sweep.
    const accounts = await ctx.db.query("authAccounts").withIndex("userIdAndProvider", (q) => q.eq("userId", userId)).collect();
    for (const account of accounts) {
      await deleteRows(ctx, await ctx.db.query("authVerificationCodes").withIndex("accountId", (q) => q.eq("accountId", account._id)).collect());
      await deleteRows(ctx, await ctx.db.query("authRateLimits").withIndex("identifier", (q) => q.eq("identifier", account._id)).collect());
      await ctx.db.delete(account._id);
    }
    await deleteRows(ctx, await ctx.db.query("profiles").withIndex("by_userId", (q) => q.eq("userId", userId)).collect());
    await deleteRows(ctx, await ctx.db.query("roommateProfiles").withIndex("by_userId", (q) => q.eq("userId", userId)).collect());
    await ctx.db.delete(userId);
    await ctx.scheduler.runAfter(0, internal.account.sweep, { userId });
  },
});
