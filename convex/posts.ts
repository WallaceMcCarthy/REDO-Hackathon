import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { deleteCommentsFor } from "./comments";
import { getOptionalUserId, requireUserId } from "./lib/auth";
import { isRateLimited, nextLikes, newestFirst, RATE_LIMIT_POSTS, shouldHide, validateBody } from "./lib/feed";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

async function townExists(ctx: MutationCtx, cityId: string) {
  return (await ctx.db.query("cities").withIndex("by_cityId", (q) => q.eq("id", cityId)).unique()) !== null;
}

/** A visible post or a thrown error; hidden posts are treated as gone. */
async function visiblePost(ctx: MutationCtx, postId: Id<"posts">): Promise<Doc<"posts">> {
  const post = await ctx.db.get(postId);
  if (!post || post.hidden) throw new ConvexError("Post not found");
  return post;
}

/** Newest first, hidden excluded. Never returns emails or user ids. */
export const listForTown = query({
  args: { cityId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const viewer = await getOptionalUserId(ctx);
    const limit = Math.min(Math.max(Math.floor(args.limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT);
    const posts = newestFirst(
      await ctx.db
        .query("posts")
        .withIndex("by_cityId", (q) => q.eq("cityId", args.cityId))
        .order("desc")
        .filter((q) => q.eq(q.field("hidden"), false))
        .take(limit),
    );
    const names = new Map<Id<"users">, string>();
    for (const p of posts) {
      if (names.has(p.userId)) continue;
      const profile = await ctx.db.query("profiles").withIndex("by_userId", (q) => q.eq("userId", p.userId)).unique();
      names.set(p.userId, profile?.displayName ?? "Utah neighbor");
    }
    return Promise.all(
      posts.map(async (p) => ({
        _id: p._id,
        cityId: p.cityId,
        body: p.body,
        likes: p.likes,
        createdAt: p._creationTime,
        isSample: p.isSample,
        authorName: names.get(p.userId)!,
        isMine: viewer !== null && p.userId === viewer,
        likedByMe:
          viewer !== null &&
          (await ctx.db
            .query("postLikes")
            .withIndex("by_post_user", (q) => q.eq("postId", p._id).eq("userId", viewer))
            .unique()) !== null,
      })),
    );
  },
});

export const create = mutation({
  args: { cityId: v.string(), body: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const parsed = validateBody(args.body);
    if (!parsed.ok) throw new ConvexError(parsed.error);
    if (!(await townExists(ctx, args.cityId))) throw new ConvexError("Unknown town");
    const recent = await ctx.db.query("posts").withIndex("by_userId", (q) => q.eq("userId", userId)).order("desc").take(RATE_LIMIT_POSTS);
    if (isRateLimited(recent.map((p) => p._creationTime), Date.now())) {
      throw new ConvexError("You're posting quickly. Wait a minute and try again.");
    }
    return ctx.db.insert("posts", {
      cityId: args.cityId,
      userId,
      body: parsed.body,
      likes: 0,
      reports: 0,
      hidden: false,
      isSample: false,
    });
  },
});

/** Real delete, with likes, comments and reports going with it. */
export const remove = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const post = await ctx.db.get(args.postId);
    if (!post) return; // already gone
    if (post.userId !== userId) throw new ConvexError("Only the author can delete this post");
    for (const like of await ctx.db.query("postLikes").withIndex("by_post_user", (q) => q.eq("postId", post._id)).collect()) {
      await ctx.db.delete(like._id);
    }
    await deleteCommentsFor(ctx, "post", post._id);
    for (const r of await ctx.db
      .query("contentReports")
      .withIndex("by_target", (q) => q.eq("targetType", "post").eq("targetId", post._id))
      .collect()) {
      await ctx.db.delete(r._id);
    }
    await ctx.db.delete(post._id);
  },
});

export const toggleLike = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const post = await visiblePost(ctx, args.postId);
    const existing = await ctx.db
      .query("postLikes")
      .withIndex("by_post_user", (q) => q.eq("postId", post._id).eq("userId", userId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    else await ctx.db.insert("postLikes", { postId: post._id, userId });
    await ctx.db.patch(post._id, { likes: nextLikes(post.likes, existing !== null) });
    return existing === null;
  },
});

/** One report per user per post; the third hides the post. */
export const report = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const post = await visiblePost(ctx, args.postId);
    if (post.userId === userId) throw new ConvexError("You can't report your own post");
    const dup = await ctx.db
      .query("contentReports")
      .withIndex("by_target_user", (q) => q.eq("targetType", "post").eq("targetId", post._id).eq("userId", userId))
      .unique();
    if (dup) return;
    await ctx.db.insert("contentReports", { targetType: "post", targetId: post._id, userId });
    const reports = post.reports + 1;
    await ctx.db.patch(post._id, { reports, hidden: shouldHide(reports) });
  },
});
