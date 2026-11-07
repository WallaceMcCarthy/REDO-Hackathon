import { defineTable } from "convex/server";
import { v } from "convex/values";

export const commentTarget = v.union(v.literal("listing"), v.literal("town"), v.literal("post"));

/** Spread into the central schema alongside authTables; owned by social backend. */
export const socialTables = {
  saved: defineTable({ userId: v.id("users"), listingId: v.string() })
    .index("by_user", ["userId"])
    .index("by_user_listing", ["userId", "listingId"]),
  comments: defineTable({
    targetType: commentTarget,
    targetId: v.string(),
    userId: v.id("users"),
    body: v.string(),
    parentId: v.union(v.id("comments"), v.null()),
    reports: v.number(),
    hidden: v.boolean(),
    isSample: v.boolean(),
  })
    .index("by_target", ["targetType", "targetId"])
    .index("by_target_parent", ["targetType", "targetId", "parentId"])
    .index("by_parent", ["parentId"]),
  contentReports: defineTable({
    targetType: v.union(v.literal("comment"), v.literal("post")),
    targetId: v.string(),
    userId: v.id("users"),
  })
    .index("by_target_user", ["targetType", "targetId", "userId"])
    .index("by_target", ["targetType", "targetId"]),
};
