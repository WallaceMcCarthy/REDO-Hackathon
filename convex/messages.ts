import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireUserId } from "./lib/auth";
import { withListingMetadata } from "./lib/listings";
import { deleteReportsFor, recordContentReport } from "./social";

type Ctx = QueryCtx | MutationCtx;
async function participant(ctx: Ctx, conversationId: Id<"conversations">) {
  const userId = await requireUserId(ctx);
  const conversation = await ctx.db.get(conversationId);
  if (!conversation || (conversation.userA !== userId && conversation.userB !== userId) || !(await ctx.db.get(userId))) {
    throw new ConvexError("Conversation not available.");
  }
  return { userId, conversation };
}
const conversationsOf = async (ctx: Ctx, userId: Id<"users">) => {
  const [a, b] = await Promise.all([
    ctx.db.query("conversations").withIndex("by_userA", q => q.eq("userA", userId)).collect(),
    ctx.db.query("conversations").withIndex("by_userB", q => q.eq("userB", userId)).collect(),
  ]);
  return [...a, ...b].sort((a, b) => b.lastMessageAt - a.lastMessageAt || a._id.localeCompare(b._id));
};
const listingOf = (ctx: Ctx, listingId: string) => ctx.db.query("listings").withIndex("by_listingId", q => q.eq("id", listingId)).first();
const blockOf = (ctx: Ctx, userId: Id<"users">, blockedUserId: Id<"users">) => ctx.db.query("userBlocks").withIndex("by_pair", q => q.eq("userId", userId).eq("blockedUserId", blockedUserId)).first();
async function requireUnblocked(ctx: Ctx, a: Id<"users">, b: Id<"users">) {
  if ((await blockOf(ctx, a, b)) || (await blockOf(ctx, b, a))) throw new ConvexError("Conversation not available.");
}

/** Exactly one conversation per unordered pair and optional listing context. */
export const startConversation = mutation({
  args: { otherUserId: v.optional(v.id("users")), recipientUserId: v.optional(v.id("users")), listingId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const me = await requireUserId(ctx);
    const other = args.otherUserId ?? args.recipientUserId;
    if (!other || (args.otherUserId && args.recipientUserId && args.otherUserId !== args.recipientUserId)) throw new ConvexError("Choose one message recipient.");
    if (me === other) throw new ConvexError("Choose another person to message.");
    if (!(await ctx.db.get(me)) || !(await ctx.db.get(other))) throw new ConvexError("Conversation not available.");
    await requireUnblocked(ctx, me, other);
    const [userA, userB] = [me, other].sort();
    const contextListingId = args.listingId ?? null;
    const existing = await ctx.db.query("conversations").withIndex("by_pair_listing", q => q.eq("userA", userA).eq("userB", userB).eq("contextListingId", contextListingId)).unique();
    if (existing) return existing._id;
    const today = await ctx.db.query("conversations").withIndex("by_starter_time", q => q.eq("startedBy", me).gte("startedAt", Date.now() - 86400000)).take(10);
    if (today.length >= 10) throw new ConvexError("You can start up to 10 new conversations per day. Try again later.");
    if (contextListingId !== null && !(await listingOf(ctx, contextListingId))) throw new ConvexError("This listing is not available.");
    const startedAt = Date.now();
    return ctx.db.insert("conversations", { userA, userB, contextListingId, lastMessage: "", lastMessageAt: startedAt, unreadA: 0, unreadB: 0, startedBy: me, startedAt });
  },
});

/** Private inbox. Names come from public display names, never email addresses. */
export const myConversations = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUserId(ctx);
    const rows = await conversationsOf(ctx, me);
    return Promise.all(rows.map(async c => {
      const otherUserId = c.userA === me ? c.userB : c.userA;
      const profile = await ctx.db.query("profiles").withIndex("by_userId", q => q.eq("userId", otherUserId)).first();
      const listing = c.contextListingId ? await listingOf(ctx, c.contextListingId) : null;
      const myBlock = await blockOf(ctx, me, otherUserId);
      return { _id: c._id, otherUserId, otherDisplayName: profile?.displayName ?? "Member", otherIsSample: profile?.isSample ?? false,
        listing: listing ? withListingMetadata(listing) : null, contextListingId: c.contextListingId,
        lastMessage: c.lastMessage, lastMessageAt: c.lastMessageAt, unreadCount: c.userA === me ? c.unreadA : c.unreadB, isBlockedByMe: !!myBlock };
    }));
  },
});

/** Newest-first cursor pages; only participants can access even an empty thread. */
export const messages = query({
  args: { conversationId: v.id("conversations"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { userId } = await participant(ctx, args.conversationId);
    const page = await ctx.db.query("messages").withIndex("by_conversation", q => q.eq("conversationId", args.conversationId))
      .order("desc").paginate({ ...args.paginationOpts, numItems: Math.min(100, Math.max(1, args.paginationOpts.numItems)) });
    return { ...page, page: await Promise.all(page.page.map(async m => {
      const report = await ctx.db.query("contentReports").withIndex("by_target_user", q => q.eq("targetType", "message").eq("targetId", m._id).eq("userId", userId)).first();
      return { _id: m._id, body: m.body, senderUserId: m.senderId, createdAt: m.createdAt, isMine: m.senderId === userId, isSample: m.isSample, hasReported: !!report };
    })) };
  },
});

export const sendMessage = mutation({
  args: { conversationId: v.id("conversations"), body: v.string() },
  handler: async (ctx, args) => {
    const { userId, conversation } = await participant(ctx, args.conversationId);
    const body = args.body.trim();
    if (!body || body.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(body)) throw new ConvexError("Message must be 1–2000 characters without control characters.");
    const otherId = conversation.userA === userId ? conversation.userB : conversation.userA;
    if (!(await ctx.db.get(otherId))) throw new ConvexError("Conversation not available.");
    await requireUnblocked(ctx, userId, otherId);
    const now = Date.now();
    const minute = await ctx.db.query("messages").withIndex("by_sender_time", q => q.eq("senderId", userId).gte("createdAt", now - 60000)).take(20);
    const day = await ctx.db.query("messages").withIndex("by_sender_time", q => q.eq("senderId", userId).gte("createdAt", now - 86400000)).take(200);
    if (minute.length >= 20 || day.length >= 200) throw new ConvexError("Message limit reached. Please try again later.");
    const profile = await ctx.db.query("profiles").withIndex("by_userId", q => q.eq("userId", userId)).first();
    const createdAt = Date.now();
    const id = await ctx.db.insert("messages", { conversationId: conversation._id, senderId: userId, body, createdAt, isSample: profile?.isSample ?? false });
    await ctx.db.patch(conversation._id, { lastMessage: body.slice(0, 160), lastMessageAt: createdAt,
      ...(conversation.userA === otherId ? { unreadA: conversation.unreadA + 1 } : { unreadB: conversation.unreadB + 1 }) });
    return id;
  },
});

export const markRead = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const { userId, conversation } = await participant(ctx, args.conversationId);
    const read = await ctx.db.query("reads").withIndex("by_user_conversation", q => q.eq("userId", userId).eq("conversationId", conversation._id)).unique();
    const lastReadAt = Date.now();
    if (read) await ctx.db.patch(read._id, { lastReadAt });
    else await ctx.db.insert("reads", { userId, conversationId: conversation._id, lastReadAt });
    await ctx.db.patch(conversation._id, conversation.userA === userId ? { unreadA: 0 } : { unreadB: 0 });
    return null;
  },
});

export const unreadTotal = query({ args: {}, handler: async ctx => {
  const me = await requireUserId(ctx);
  return (await conversationsOf(ctx, me)).reduce((sum, c) => sum + (c.userA === me ? c.unreadA : c.unreadB), 0);
} });

/** Reuse deduplicated reports without granting nonparticipants access to messages. */
export const reportMessage = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    await requireUserId(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new ConvexError("Message not available.");
    const { userId } = await participant(ctx, message.conversationId);
    if (message.senderId === userId) throw new ConvexError("You cannot report your own message.");
    const added = await recordContentReport(ctx, "message", message._id, userId);
    return { reported: true, alreadyReported: !added };
  },
});

export const block = mutation({ args: { userId: v.id("users") }, handler: async (ctx, args) => {
  const me = await requireUserId(ctx);
  if (me === args.userId) throw new ConvexError("Choose another person.");
  if ((await ctx.db.get(args.userId)) && !(await blockOf(ctx, me, args.userId))) await ctx.db.insert("userBlocks", { userId: me, blockedUserId: args.userId });
  return null;
} });
export const unblock = mutation({ args: { userId: v.id("users") }, handler: async (ctx, args) => {
  const me = await requireUserId(ctx);
  const existing = await blockOf(ctx, me, args.userId);
  if (existing) await ctx.db.delete(existing._id);
  return null;
} });

/** Server-only account-deletion helper; no registered client entry point. */
export async function deleteConversationsForUser(ctx: MutationCtx, userId: Id<"users">) {
  for (const conversation of await conversationsOf(ctx, userId)) {
    for (const message of await ctx.db.query("messages").withIndex("by_conversation", q => q.eq("conversationId", conversation._id)).collect()) {
      await deleteReportsFor(ctx, "message", message._id);
      await ctx.db.delete(message._id);
    }
    for (const read of await ctx.db.query("reads").withIndex("by_conversation", q => q.eq("conversationId", conversation._id)).collect()) await ctx.db.delete(read._id);
    await ctx.db.delete(conversation._id);
  }
  const [out, incoming] = await Promise.all([
    ctx.db.query("userBlocks").withIndex("by_user", q => q.eq("userId", userId)).collect(),
    ctx.db.query("userBlocks").withIndex("by_blocked", q => q.eq("blockedUserId", userId)).collect(),
  ]);
  for (const row of [...out, ...incoming]) await ctx.db.delete(row._id);
}

// Keep the first UI contract usable while canonical task names remain available.
export const inbox = myConversations;
export const thread = messages;
export const send = sendMessage;
export const unreadCount = unreadTotal;
