import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { redoClient } from "./lib/payments";

declare const process: { env?: Record<string, string | undefined> } | undefined;

export const getActivePins = query({
  args: {
    cityId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("campaigns")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    return rows.filter((c) => {
      if (c.endsAt && c.endsAt < now) return false;
      if (c.kind !== "pin" && c.kind !== "job") return false;
      if (args.cityId && c.cityId && c.cityId !== args.cityId) return false;
      return true;
    });
  },
});

export const getActiveFeatured = query({
  args: {
    cityId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("campaigns")
      .withIndex("by_status_kind", (q) => q.eq("status", "active").eq("kind", "featured"))
      .collect();

    return rows.filter((c) => {
      if (c.endsAt && c.endsAt < now) return false;
      if (args.cityId && c.cityId && c.cityId !== args.cityId) return false;
      return true;
    });
  },
});

export const listMyCampaigns = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("campaigns")
      .withIndex("by_advertiser", (q) => q.eq("advertiserUserId", userId))
      .collect();
    return rows.sort((a, b) => b.startsAt - a.startsAt);
  },
});

export const createCampaign = mutation({
  args: {
    kind: v.union(v.literal("pin"), v.literal("featured"), v.literal("job")),
    title: v.string(),
    body: v.string(),
    url: v.string(),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    listingId: v.optional(v.string()),
    cityId: v.optional(v.string()),
    durationDays: v.number(),
    isSample: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    const durationMs = Math.max(1, args.durationDays) * 24 * 3600 * 1000;

    const ratePerDay = args.kind === "featured" ? 1000 : args.kind === "job" ? 700 : 500;
    const amount = ratePerDay * args.durationDays;

    const campaignId = await ctx.db.insert("campaigns", {
      advertiserUserId: userId,
      kind: args.kind,
      title: args.title.trim(),
      body: args.body.trim(),
      url: args.url.trim(),
      lat: args.lat,
      lng: args.lng,
      listingId: args.listingId,
      cityId: args.cityId,
      startsAt: now,
      endsAt: now + durationMs,
      status: "pending_payment",
      impressions: 0,
      clicks: 0,
      isSample: args.isSample ?? false,
      expectedAmount: amount,
      expectedCurrency: "USD",
    });

    // Generate in-app sandbox checkout session
    const session = await redoClient.createCheckoutSession({
      campaignId: String(campaignId),
      amount,
      currency: "USD",
      title: `${args.kind.toUpperCase()} Campaign: ${args.title}`,
      description: `Utah Fit advertising sponsorship (${args.durationDays} days)`,
      successUrl: `${process?.env?.SITE_URL || "https://cmascope.com"}/ads/success`,
      cancelUrl: `${process?.env?.SITE_URL || "https://cmascope.com"}/ads/cancel`,
    });

    return {
      campaignId: String(campaignId),
      checkoutUrl: session.checkoutUrl,
      amount,
    };
  },
});

export const recordImpression = mutation({
  args: {
    campaignId: v.id("campaigns"),
  },
  handler: async (ctx, args) => {
    // Phase 3 ground rule: every write checks ctx.auth
    await requireUserId(ctx);
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) return;
    await ctx.db.patch(args.campaignId, {
      impressions: (campaign.impressions || 0) + 1,
    });
  },
});

export const recordClick = mutation({
  args: {
    campaignId: v.id("campaigns"),
  },
  handler: async (ctx, args) => {
    // Phase 3 ground rule: every write checks ctx.auth
    await requireUserId(ctx);
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) return;
    await ctx.db.patch(args.campaignId, {
      clicks: (campaign.clicks || 0) + 1,
    });
  },
});

/**
 * Sandbox simulation endpoint for testing payments prior to live REDO credentials.
 * Conforms to review instructions: calls internal sample-only path.
 */
export const simulateSandboxPayment = mutation({
  args: {
    campaignId: v.id("campaigns"),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");
    if (campaign.advertiserUserId !== userId) {
      throw new Error("Only the campaign owner can simulate payment");
    }

    const rawEventId = `sim_evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const redoPaymentId = `sim_pay_${Date.now()}`;
    const amount = campaign.expectedAmount || 3500;
    const currency = campaign.expectedCurrency || "USD";

    await ctx.db.insert("payments", {
      campaignId: args.campaignId,
      redoPaymentId,
      amount,
      currency,
      status: "succeeded (sandbox simulation)",
      rawEventId,
    });

    await ctx.db.patch(args.campaignId, {
      status: "active",
      redoPaymentId,
    });

    return { success: true, status: "active", campaignId: args.campaignId };
  },
});

export const fulfillRedoPayment = internalMutation({
  args: {
    campaignId: v.id("campaigns"),
    redoPaymentId: v.string(),
    amount: v.number(),
    currency: v.string(),
    rawEventId: v.string(),
  },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${args.campaignId} not found`);
    }

    // Verify received payment satisfies expected amount and currency
    if (campaign.expectedAmount && args.amount < campaign.expectedAmount) {
      throw new Error(`Insufficient payment amount: received ${args.amount}, expected ${campaign.expectedAmount}`);
    }
    if (campaign.expectedCurrency && args.currency.toUpperCase() !== campaign.expectedCurrency.toUpperCase()) {
      throw new Error(`Currency mismatch: received ${args.currency}, expected ${campaign.expectedCurrency}`);
    }

    const existing = await ctx.db
      .query("payments")
      .withIndex("by_rawEventId", (q) => q.eq("rawEventId", args.rawEventId))
      .first();

    if (existing) {
      return { status: "already_processed" };
    }

    await ctx.db.insert("payments", {
      campaignId: args.campaignId,
      redoPaymentId: args.redoPaymentId,
      amount: args.amount,
      currency: args.currency,
      status: "succeeded",
      rawEventId: args.rawEventId,
    });

    if (!campaign.advertiserUserId) {
      // The advertiser deleted their account mid-checkout: keep the money on record, never go live.
      await ctx.db.patch(args.campaignId, { redoPaymentId: args.redoPaymentId });
      return { status: "recorded_without_activation" };
    }

    await ctx.db.patch(args.campaignId, {
      status: "active",
      redoPaymentId: args.redoPaymentId,
    });

    return { status: "activated" };
  },
});
