import { defineTable } from "convex/server";
import { v } from "convex/values";

/** Spread into defineSchema at integration: `...roommateTables`. */
export const roommateTables = {
  roommateProfiles: defineTable({
    userId: v.id("users"),
    budgetMin: v.number(),
    budgetMax: v.number(),
    cityIds: v.array(v.string()),
    moveIn: v.number(),
    tags: v.array(v.string()),
    bio: v.string(),
    contact: v.string(),
    active: v.boolean(),
    isSample: v.boolean(),
  })
    .index("by_userId", ["userId"])
    .index("by_active", ["active"]),
  connections: defineTable({
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("declined")),
  })
    .index("by_pair", ["fromUserId", "toUserId"])
    .index("by_from", ["fromUserId"])
    .index("by_to", ["toUserId"]),
};
