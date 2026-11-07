import { defineTable } from "convex/server";
import { v } from "convex/values";

export const campaignKindValidator = v.union(
  v.literal("pin"),
  v.literal("featured"),
  v.literal("job"),
);

export const campaignStatusValidator = v.union(
  v.literal("pending_payment"),
  v.literal("active"),
  v.literal("expired"),
);

/**
 * Advertising and REDO Payments tables.
 * Spread into root schema alongside authTables, socialTables, etc.
 */
export const adsTables = {
  campaigns: defineTable({
    advertiserUserId: v.id("users"),
    kind: campaignKindValidator,
    title: v.string(),
    body: v.string(),
    url: v.string(),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    listingId: v.optional(v.string()),
    cityId: v.optional(v.string()),
    startsAt: v.number(),
    endsAt: v.number(),
    status: campaignStatusValidator,
    redoPaymentId: v.optional(v.string()),
    impressions: v.number(),
    clicks: v.number(),
    isSample: v.boolean(),
  })
    .index("by_advertiser", ["advertiserUserId"])
    .index("by_status", ["status"])
    .index("by_status_kind", ["status", "kind"])
    .index("by_cityId", ["cityId"]),

  payments: defineTable({
    campaignId: v.id("campaigns"),
    redoPaymentId: v.string(),
    amount: v.number(),
    currency: v.string(),
    status: v.string(),
    rawEventId: v.string(),
  })
    .index("by_campaignId", ["campaignId"])
    .index("by_redoPaymentId", ["redoPaymentId"])
    .index("by_rawEventId", ["rawEventId"]),
};
