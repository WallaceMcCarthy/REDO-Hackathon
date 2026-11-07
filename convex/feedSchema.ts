import { defineTable } from "convex/server";
import { v } from "convex/values";

/** Spread into defineSchema at integration: `...feedTables`. */
export const feedTables = {
  posts: defineTable({
    cityId: v.string(),
    userId: v.id("users"),
    body: v.string(),
    likes: v.number(),
    reports: v.number(),
    hidden: v.boolean(),
    isSample: v.boolean(),
  })
    .index("by_cityId", ["cityId"])
    // powers the per-user create rate limit
    .index("by_userId", ["userId"]),
  postLikes: defineTable({
    postId: v.id("posts"),
    userId: v.id("users"),
  }).index("by_post_user", ["postId", "userId"]),
};
