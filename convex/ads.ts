import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { redoClient } from "./lib/payments";

declare const process: { env?: Record<string, string | undefined> } | undefined;

/** Geographic bounding box covering the state of Utah */
export const UTAH_BOUNDS = {
  minLat: 36.9,
  maxLat: 42.1,
  minLng: -114.1,
  maxLng: -108.9,
};

/**
 * Validates destination URLs:
 * 1. Must parse cleanly with new URL()
 * 2. Must use strictly HTTPS protocol (no javascript:, data:, http:, etc.)
 * 3. Enforces reasonable length bound (<= 500 chars)
 */
export function validateHttpsUrl(rawUrl: string): string {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) {
    throw new Error("Destination URL is required");
  }
  if (trimmed.length > 500) {
    throw new Error("Destination URL exceeds maximum length of 500 characters");
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Invalid destination URL format");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Destination URL must use HTTPS protocol (https://)");
  }
  return parsed.toString();
}

export const isSandboxPaymentAllowed = query({
  args: {},
  handler: async () => {
    return process?.env?.ALLOW_SANDBOX_PAYMENTS === "true";
  },
});

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
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    // 1. Title validation
    const title = args.title.trim();
    if (title.length < 3 || title.length > 80) {
      throw new Error("Campaign title must be between 3 and 80 characters");
    }

    // 2. Body validation
    const body = args.body.trim();
    if (body.length < 5 || body.length > 300) {
      throw new Error("Campaign description must be between 5 and 300 characters");
    }

    // 3. Strict HTTPS URL validation (prevents stored XSS attacks)
    const validUrl = validateHttpsUrl(args.url);

    // 4. Duration bounds
    const durationDays = Math.round(args.durationDays);
    if (durationDays < 1 || durationDays > 90) {
      throw new Error("Campaign duration must be between 1 and 90 days");
    }

    // 5. Geographic validation for map pins
    if (args.kind === "pin" || args.kind === "job") {
      if (args.lat !== undefined || args.lng !== undefined) {
        if (
          args.lat === undefined ||
          args.lng === undefined ||
          args.lat < UTAH_BOUNDS.minLat ||
          args.lat > UTAH_BOUNDS.maxLat ||
          args.lng < UTAH_BOUNDS.minLng ||
          args.lng > UTAH_BOUNDS.maxLng
        ) {
          throw new Error(
            `Location coordinates must be within Utah bounds (${UTAH_BOUNDS.minLat}° to ${UTAH_BOUNDS.maxLat}° N, ${UTAH_BOUNDS.minLng}° to ${UTAH_BOUNDS.maxLng}° W)`
          );
        }
      }
    }

    const now = Date.now();
    const durationMs = durationDays * 24 * 3600 * 1000;
    const ratePerDay = args.kind === "featured" ? 1000 : args.kind === "job" ? 700 : 500;
    const amount = ratePerDay * durationDays;

    const campaignId = await ctx.db.insert("campaigns", {
      advertiserUserId: userId,
      kind: args.kind,
      title,
      body,
      url: validUrl,
      lat: args.lat,
      lng: args.lng,
      listingId: args.listingId,
      cityId: args.cityId,
      startsAt: now,
      endsAt: now + durationMs,
      status: "pending_payment",
      impressions: 0,
      clicks: 0,
      // Phase 3 security rule: isSample is never client-settable on public mutation
      isSample: false,
      expectedAmount: amount,
      expectedCurrency: "USD",
    });

    const session = await redoClient.createCheckoutSession({
      campaignId: String(campaignId),
      amount,
      currency: "USD",
      title: `${args.kind.toUpperCase()} Campaign: ${title}`,
      description: `Utah Fit advertising sponsorship (${durationDays} days)`,
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
    const userId = await requireUserId(ctx);
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) return;

    // Self-view metric inflation prevention
    if (campaign.advertiserUserId === userId) return;

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
    const userId = await requireUserId(ctx);
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) return;

    // Self-click metric inflation prevention
    if (campaign.advertiserUserId === userId) return;

    await ctx.db.patch(args.campaignId, {
      clicks: (campaign.clicks || 0) + 1,
    });
  },
});

/**
 * Sandbox simulation endpoint for testing payments prior to live REDO credentials.
 * Fails closed unless ALLOW_SANDBOX_PAYMENTS is explicitly "true" in environment.
 */
export const simulateSandboxPayment = mutation({
  args: {
    campaignId: v.id("campaigns"),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (process?.env?.ALLOW_SANDBOX_PAYMENTS !== "true") {
      throw new Error(
        "Sandbox payment simulation is disabled on this deployment (ALLOW_SANDBOX_PAYMENTS must be 'true'). Official REDO payment webhook required."
      );
    }

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
      isSample: true, // Sandbox simulation strictly marks the campaign as sample content
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

    await ctx.db.patch(args.campaignId, {
      status: "active",
      redoPaymentId: args.redoPaymentId,
    });

    return { status: "activated" };
  },
});
