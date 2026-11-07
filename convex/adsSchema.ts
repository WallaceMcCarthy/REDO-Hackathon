import { defineTable } from "convex/server";
import { v } from "convex/values";
import { AD_CATEGORY_IDS } from "./lib/adCategories";

export const campaignKindValidator = v.union(
  v.literal("pin"),
  v.literal("featured"),
  v.literal("job"),
);

export const campaignCategoryValidator = v.union(...AD_CATEGORY_IDS.map((c) => v.literal(c)));

export const campaignStatusValidator = v.union(
  v.literal("pending_payment"),
  v.literal("active"),
  v.literal("expired"),
  // Set only by async Jev moderation (#99), gated behind JEV_MODERATION_ENABLED
  // (off by default): a free ad held or rejected before going public.
  v.literal("pending_review"),
);

/**
 * Advertising and REDO Payments tables.
 * Spread into root schema alongside authTables, socialTables, etc.
 */
export const adsTables = {
  campaigns: defineTable({
    // Unset once the advertiser deletes their account; the row stays because payments point at it.
    advertiserUserId: v.optional(v.id("users")),
    kind: campaignKindValidator,
    // Optional because rows created before categories exist have none; readers treat those as "other".
    category: v.optional(campaignCategoryValidator),
    title: v.string(),
    body: v.string(),
    url: v.string(),
    imageUrl: v.optional(v.string()),
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
    // Populated only by async Jev moderation (#99); absent when moderation is
    // disabled or hasn't run yet.
    moderationReasons: v.optional(v.array(v.string())),
    // Set when the moderation call itself failed (provider error/timeout), not
    // when content was judged. Existing behaviour (status) is left unchanged;
    // this just surfaces the row for a human to double check.
    moderationFlag: v.optional(v.literal("review")),
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

  /** Aggregate-only reporting; no viewer identity or browser location is stored here. */
  campaignDailyStats: defineTable({
    campaignId: v.id("campaigns"),
    day: v.number(),
    surface: v.union(v.literal("results_featured"), v.literal("town_highlights"), v.literal("unknown")),
    pageTownId: v.optional(v.string()),
    impressions: v.number(),
    clicks: v.number(),
  })
    .index("by_campaign_day_surface_town", ["campaignId", "day", "surface", "pageTownId"])
    .index("by_campaign_day", ["campaignId", "day"]),
};
