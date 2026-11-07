import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getOptionalUserId, requireUserId } from "./lib/auth";
import { checkOwner, checkParent, cleanComment, nextReportState, type CommentTarget } from "./lib/social";
import { commentTarget } from "./socialSchema";
import { withListingMetadata } from "./lib/listings";
import { findMarketListing } from "./marketSearch";

type ReadCtx = QueryCtx | MutationCtx;

async function findListing(ctx: ReadCtx, listingId: string) {
  if (listingId.startsWith("market:")) return findMarketListing(ctx, listingId);
  // Public record IDs survive reseeding; Convex-generated document IDs do not.
  return ctx.db.query("listings").withIndex("by_listingId", (q) => q.eq("id", listingId)).first();
}

async function targetExists(ctx: ReadCtx, targetType: CommentTarget, targetId: string): Promise<boolean> {
  if (targetType === "listing") return (await findListing(ctx, targetId)) !== null;
  if (targetType === "town") {
    return (await ctx.db.query("cities").withIndex("by_cityId", (q) => q.eq("id", targetId)).first()) !== null;
  }
  const postId = ctx.db.normalizeId("posts", targetId);
  const post = postId ? await ctx.db.get(postId) : null;
  return post !== null && !post.hidden;
}

async function publicComment(ctx: ReadCtx, comment: Doc<"comments">, viewerId: Id<"users"> | null) {
  const profile = await ctx.db.query("profiles").withIndex("by_userId", (q) => q.eq("userId", comment.userId)).first();
  const report = viewerId ? await ctx.db.query("contentReports").withIndex("by_target_user", (q) => q.eq("targetType", "comment").eq("targetId", comment._id).eq("userId", viewerId)).first() : null;
  return {
    _id: comment._id,
    _creationTime: comment._creationTime,
    createdAt: comment._creationTime,
    targetType: comment.targetType,
    targetId: comment.targetId,
    userId: comment.userId,
    authorName: profile?.displayName?.trim() || "Community member",
    displayName: profile?.displayName?.trim() || "Community member",
    body: comment.body,
    parentId: comment.parentId,
    reports: comment.reports,
    isSample: comment.isSample,
    canDelete: viewerId === comment.userId,
    hasReported: report !== null,
  };
}

/** Private paginated bookmarks; signed-out callers get an empty page. */
export const mySaved = query({
  args: { paginationOpts: v.optional(paginationOptsValidator) },
  handler: async (ctx, args) => {
    const userId = await getOptionalUserId(ctx);
    if (!userId) return { page: [], isDone: true, continueCursor: "" };
    const opts = args.paginationOpts ?? { numItems: 50, cursor: null };
    const page = await ctx.db.query("saved").withIndex("by_user", (q) => q.eq("userId", userId)).order("desc").paginate({ ...opts, numItems: Math.min(100, Math.max(1, opts.numItems)) });
    return {
      ...page,
      page: await Promise.all(page.page.map(async (save) => {
        const listing = await findListing(ctx, save.listingId);
        return {
          _id: save._id, listingId: save.listingId, savedAt: save._creationTime,
          listing: listing ? withListingMetadata(listing) : null,
        };
      })),
    };
  },
});

/** One subscription for all visible hearts, instead of one query per card. */
export const savedIds = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db.query("saved").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    return rows.map((row) => row.listingId);
  },
});

export const isSaved = query({
  args: { listingId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getOptionalUserId(ctx);
    if (!userId) return false;
    return (await ctx.db.query("saved").withIndex("by_user_listing", (q) => q.eq("userId", userId).eq("listingId", args.listingId)).first()) !== null;
  },
});

export const toggleSaved = mutation({
  args: { listingId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.query("saved").withIndex("by_user_listing", (q) => q.eq("userId", userId).eq("listingId", args.listingId)).first();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { saved: false };
    }
    if (!(await findListing(ctx, args.listingId))) throw new Error("This property record is unavailable");
    await ctx.db.insert("saved", { userId, listingId: args.listingId });
    return { saved: true };
  },
});

/** Newest root threads first, with newest replies first. Hidden content is omitted. */
export const comments = query({
  args: { targetType: commentTarget, targetId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    if (!(await targetExists(ctx, args.targetType, args.targetId))) return [];
    const viewerId = await getOptionalUserId(ctx);
    const limit = Math.max(1, Math.min(50, Math.floor(args.limit ?? 20)));
    const roots = await ctx.db.query("comments").withIndex("by_target_parent", (q) => q.eq("targetType", args.targetType).eq("targetId", args.targetId).eq("parentId", null)).order("desc").filter((q) => q.eq(q.field("hidden"), false)).take(limit);
    return Promise.all(roots.map(async (root) => {
      const replies = await ctx.db.query("comments").withIndex("by_parent", (q) => q.eq("parentId", root._id)).order("desc").filter((q) => q.eq(q.field("hidden"), false)).take(51);
      return {
        ...(await publicComment(ctx, root, viewerId)),
        replies: await Promise.all(replies.slice(0, 50).map((reply) => publicComment(ctx, reply, viewerId))),
        hasMoreReplies: replies.length > 50,
      };
    }));
  },
});

/** Visible comment counts (roots and replies) for many listings in one call. Capped per target. */
export const commentCounts = query({
  args: { targetType: commentTarget, targetIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const ids = [...new Set(args.targetIds)].slice(0, 100);
    const counts: Record<string, number> = {};
    await Promise.all(ids.map(async (targetId) => {
      const rows = await ctx.db.query("comments").withIndex("by_target", (q) => q.eq("targetType", args.targetType).eq("targetId", targetId)).filter((q) => q.eq(q.field("hidden"), false)).take(100);
      if (rows.length > 0) counts[targetId] = rows.length;
    }));
    return counts;
  },
});

/** Replies can be paginated independently when a root has more than fifty. */
export const replies = query({
  args: { parentId: v.id("comments"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const root = await ctx.db.get(args.parentId);
    if (!root || root.hidden || root.parentId !== null || !(await targetExists(ctx, root.targetType, root.targetId))) return { page: [], isDone: true, continueCursor: "" };
    const viewerId = await getOptionalUserId(ctx);
    const page = await ctx.db.query("comments").withIndex("by_parent", (q) => q.eq("parentId", root._id)).order("desc").filter((q) => q.eq(q.field("hidden"), false)).paginate({ ...args.paginationOpts, numItems: Math.min(50, Math.max(1, args.paginationOpts.numItems)) });
    return { ...page, page: await Promise.all(page.page.map((row) => publicComment(ctx, row, viewerId))) };
  },
});

export const addComment = mutation({
  args: { targetType: commentTarget, targetId: v.string(), body: v.string(), parentId: v.optional(v.union(v.id("comments"), v.null())) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const body = cleanComment(args.body);
    if (!(await targetExists(ctx, args.targetType, args.targetId))) throw new Error("This discussion is unavailable");
    if (args.parentId) checkParent(await ctx.db.get(args.parentId), args.targetType, args.targetId);
    const profile = await ctx.db.query("profiles").withIndex("by_userId", (q) => q.eq("userId", userId)).first();
    return ctx.db.insert("comments", {
      targetType: args.targetType, targetId: args.targetId, userId, body,
      parentId: args.parentId ?? null, reports: 0, hidden: false, isSample: profile?.isSample ?? false,
    });
  },
});

/** Shared by the feed: only call after authenticating the reporting user. */
export async function recordContentReport(ctx: MutationCtx, targetType: "comment" | "post" | "message", targetId: string, userId: Id<"users">): Promise<boolean> {
  const existing = await ctx.db.query("contentReports").withIndex("by_target_user", (q) => q.eq("targetType", targetType).eq("targetId", targetId).eq("userId", userId)).first();
  if (existing) return false;
  await ctx.db.insert("contentReports", { targetType, targetId, userId });
  return true;
}

export async function deleteReportsFor(ctx: MutationCtx, targetType: "comment" | "post" | "message", targetId: string): Promise<void> {
  const reports = await ctx.db.query("contentReports").withIndex("by_target", (q) => q.eq("targetType", targetType).eq("targetId", targetId)).collect();
  for (const report of reports) await ctx.db.delete(report._id);
}

/**
 * Touches at most `limit` rows and returns how many it touched; repeat until the comment is gone.
 * Reports need no limit: a comment stops accepting them once hidden, at three.
 */
export async function deleteCommentBatch(ctx: MutationCtx, comment: Doc<"comments">, limit: number): Promise<number> {
  // Preserve other authors' replies after the deleted parent's actual removal.
  const children = await ctx.db.query("comments").withIndex("by_parent", (q) => q.eq("parentId", comment._id)).take(limit);
  for (const child of children) await ctx.db.patch(child._id, { parentId: null });
  if (children.length === limit) return limit;
  await deleteReportsFor(ctx, "comment", comment._id);
  await ctx.db.delete(comment._id);
  return children.length + 1;
}

export const deleteComment = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const comment = await ctx.db.get(args.commentId);
    if (!comment) return { deleted: false };
    checkOwner(userId, comment.userId);
    while (await ctx.db.get(comment._id)) await deleteCommentBatch(ctx, comment, 1000);
    return { deleted: true };
  },
});

export const reportComment = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("This comment is unavailable");
    if (comment.userId === userId) throw new Error("Delete your own comment instead of reporting it");
    if (comment.hidden) return { reported: false, hidden: true };
    const added = await recordContentReport(ctx, "comment", comment._id, userId);
    if (!added) return { reported: false, hidden: comment.hidden };
    const state = nextReportState(comment.reports);
    await ctx.db.patch(comment._id, state);
    return { reported: true, hidden: state.hidden };
  },
});

/** Feed deletion cascade. This is a TS helper, not a client-callable mutation. */
export async function deleteCommentsFor(ctx: MutationCtx, targetType: CommentTarget, targetId: string, limit: number): Promise<number> {
  const rows = await ctx.db.query("comments").withIndex("by_target", (q) => q.eq("targetType", targetType).eq("targetId", targetId)).take(limit);
  for (const row of rows) {
    await deleteReportsFor(ctx, "comment", row._id);
    await ctx.db.delete(row._id);
  }
  return rows.length;
}
