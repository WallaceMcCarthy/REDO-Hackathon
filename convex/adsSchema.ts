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
    expectedAmount: v.optional(v.number()),
    expectedCurrency: v.optional(v.string()),
  })
    .index("by_advertiser", ["advertiserUserId"])
    .index("by_status", ["status"])
    .index("by_status_kind", ["status", "kind"])
    .index("by_cityId", ["cityId"]),

  payments: defineTable({
    campaignId: v.id("campaigns"),
    redoPaymentId: v.optional(v.string()),
    provider: v.optional(v.string()),
    stripeSessionId: v.optional(v.string()),
    amount: v.number(),
    currency: v.string(),
    status: v.string(),
    rawEventId: v.string(),
  })
    .index("by_campaignId", ["campaignId"])
    .index("by_redoPaymentId", ["redoPaymentId"])
    .index("by_rawEventId", ["rawEventId"])
    .index("by_stripeSessionId", ["stripeSessionId"]),

  /** Dedupe/rate-limit ledger for sponsored impressions and clicks (one row per viewer/kind/hour). */
  adEvents: defineTable({
    campaignId: v.id("campaigns"),
    kind: v.union(v.literal("impression"), v.literal("click")),
    viewerKey: v.string(),
    bucket: v.number(),
  })
    .index("by_campaign_kind_viewer_bucket", ["campaignId", "kind", "viewerKey", "bucket"])
    .index("by_campaign_kind_bucket", ["campaignId", "kind", "bucket"]),
};
