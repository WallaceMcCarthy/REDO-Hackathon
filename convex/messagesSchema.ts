import { defineTable } from "convex/server";
import { v } from "convex/values";

export const messageTables = {
  conversations: defineTable({
    userA: v.id("users"), userB: v.id("users"), contextListingId: v.union(v.string(), v.null()),
    lastMessage: v.string(), lastMessageAt: v.number(), unreadA: v.number(), unreadB: v.number(),
    startedBy: v.id("users"), startedAt: v.number(),
  }).index("by_userA", ["userA"]).index("by_userB", ["userB"])
    .index("by_pair_listing", ["userA", "userB", "contextListingId"])
    .index("by_starter_time", ["startedBy", "startedAt"]),
  messages: defineTable({ conversationId: v.id("conversations"), senderId: v.id("users"), body: v.string(), createdAt: v.number(), isSample: v.boolean() })
    .index("by_conversation", ["conversationId"]).index("by_sender_time", ["senderId", "createdAt"]),
  userBlocks: defineTable({ userId: v.id("users"), blockedUserId: v.id("users") })
    .index("by_pair", ["userId", "blockedUserId"])
    .index("by_user", ["userId"]).index("by_blocked", ["blockedUserId"]),
  reads: defineTable({ userId: v.id("users"), conversationId: v.id("conversations"), lastReadAt: v.number() })
    .index("by_user_conversation", ["userId", "conversationId"])
    .index("by_conversation", ["conversationId"]),
};
