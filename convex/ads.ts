import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { campaignCategoryValidator } from "./adsSchema";
import type { AdCategory } from "./lib/adCategories";
import { requireUserId } from "./lib/auth";
import { redoClient, selectPaymentClient } from "./lib/payments";
import { priceCents, type CampaignKind } from "./lib/pricing";

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
export function validateHttpsUrl(rawUrl: string, label = "Destination URL"): string {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) {
    throw new ConvexError(`${label} is required`);
  }
  if (trimmed.length > 500) {
    throw new ConvexError(`${label} exceeds maximum length of 500 characters`);
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ConvexError(`Invalid ${label} format`);
  }
  if (parsed.protocol !== "https:") {
    throw new ConvexError(`${label} must use HTTPS protocol (https://)`);
  }
  return parsed.toString();
}

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

const campaignArgs = {
  kind: v.union(v.literal("pin"), v.literal("featured"), v.literal("job")),
  category: v.optional(campaignCategoryValidator),
  title: v.string(),
  body: v.string(),
  url: v.string(),
  imageUrl: v.optional(v.string()),
  lat: v.optional(v.number()),
  lng: v.optional(v.number()),
  listingId: v.optional(v.string()),
  cityId: v.optional(v.string()),
  durationDays: v.number(),
};

type CampaignInput = {
  kind: CampaignKind;
  category?: AdCategory;
  title: string;
  body: string;
  url: string;
  imageUrl?: string;
  lat?: number;
  lng?: number;
  listingId?: string;
  cityId?: string;
  durationDays: number;
};

/** Validate client input and insert a pending_payment campaign priced server-side. */
async function insertPendingCampaign(ctx: MutationCtx, userId: Id<"users">, args: CampaignInput) {
  // 1. Title validation
  const title = args.title.trim();
  if (title.length < 3 || title.length > 80) {
    throw new ConvexError("Campaign title must be between 3 and 80 characters");
  }

  // 2. Body validation
  const body = args.body.trim();
  if (body.length < 5 || body.length > 300) {
    throw new ConvexError("Campaign description must be between 5 and 300 characters");
  }

  // 3. Strict HTTPS URL validation (prevents stored XSS attacks)
  const validUrl = validateHttpsUrl(args.url);
  const imageUrl = args.imageUrl?.trim() ? validateHttpsUrl(args.imageUrl, "Image URL") : undefined;

  // 4. Duration bounds
  const durationDays = Math.round(args.durationDays);
  if (durationDays < 1 || durationDays > 90) {
    throw new ConvexError("Campaign duration must be between 1 and 90 days");
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
        throw new ConvexError(
          `Location coordinates must be within Utah bounds (${UTAH_BOUNDS.minLat}° to ${UTAH_BOUNDS.maxLat}° N, ${UTAH_BOUNDS.minLng}° to ${UTAH_BOUNDS.maxLng}° W)`
        );
      }
    }
  }

  // 6. A campaign aimed at an unknown town would be paid for and shown nowhere
  const { cityId } = args;
  if (cityId && !(await ctx.db.query("cities").withIndex("by_cityId", (q) => q.eq("id", cityId)).unique())) {
    throw new ConvexError("Choose a target town from the list");
  }

  const now = Date.now();
  const durationMs = durationDays * 24 * 3600 * 1000;
  const amount = priceCents(args.kind, durationDays);

  const campaignId = await ctx.db.insert("campaigns", {
    advertiserUserId: userId,
    kind: args.kind,
    category: args.category ?? "other",
    title,
    body,
    url: validUrl,
    imageUrl,
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

  return { campaignId, amount, title, durationDays };
}

const siteUrl = () => (process?.env?.SITE_URL || "https://cmascope.com").replace(/\/+$/, "");

/** REDO sandbox path (kept as the alternate provider). */
export const createCampaign = mutation({
  args: campaignArgs,
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const { campaignId, amount, title, durationDays } = await insertPendingCampaign(ctx, userId, args);

    const session = await redoClient.createCheckoutSession({
      campaignId: String(campaignId),
      amount,
      currency: "USD",
      title: `${args.kind.toUpperCase()} Campaign: ${title}`,
      description: `Utah Fit advertising sponsorship (${durationDays} days)`,
      successUrl: `${siteUrl()}/ads/success`,
      cancelUrl: `${siteUrl()}/ads/cancel`,
    });

    return {
      campaignId: String(campaignId),
      checkoutUrl: session.checkoutUrl,
      amount,
    };
  },
});

export const createPendingCampaign = internalMutation({
  args: { userId: v.id("users"), ...campaignArgs },
  handler: async (ctx, { userId, ...args }) => {
    const r = await insertPendingCampaign(ctx, userId, args);
    return { campaignId: r.campaignId, amount: r.amount, title: r.title, durationDays: r.durationDays };
  },
});

export const recordCheckoutSession = internalMutation({
  args: {
    campaignId: v.id("campaigns"),
    provider: v.string(),
    sessionId: v.string(),
    amount: v.number(),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("payments", {
      campaignId: args.campaignId,
      provider: args.provider,
      stripeSessionId: args.provider === "stripe" ? args.sessionId : undefined,
      amount: args.amount,
      currency: args.currency,
      status: "pending",
      rawEventId: `pending:${args.sessionId}`,
    });
  },
});

/**
 * Checkout entry point. Stripe when STRIPE_SECRET_KEY is set, else the labeled sandbox.
 * The amount is always computed server-side from kind and duration.
 */
export const createCheckout = action({
  args: campaignArgs,
  handler: async (
    ctx,
    args,
  ): Promise<{ campaignId: string; checkoutUrl: string; amount: number; provider: "redo" | "stripe" }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required");

    const created: { campaignId: Id<"campaigns">; amount: number; title: string; durationDays: number } =
      await ctx.runMutation(internal.ads.createPendingCampaign, { userId, ...args });

    const client = selectPaymentClient();
    const session = await client.createCheckoutSession({
      campaignId: String(created.campaignId),
      amount: created.amount,
      currency: "USD",
      title: `${created.title}, ${args.kind}`,
      description: `Utah Fit advertising sponsorship (${created.durationDays} days)`,
      successUrl: `${siteUrl()}/#ads?paid={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${siteUrl()}/#ads?canceled=1`,
    });

    if (client.provider === "stripe") {
      await ctx.runMutation(internal.ads.recordCheckoutSession, {
        campaignId: created.campaignId,
        provider: "stripe",
        sessionId: session.sessionId,
        amount: created.amount,
        currency: "USD",
      });
    }

    return {
      campaignId: String(created.campaignId),
      checkoutUrl: session.checkoutUrl,
      amount: created.amount,
      provider: client.provider,
    };
  },
});

/** Public flag so the UI can show the Stripe test-mode note. */
export const paymentProvider = query({
  args: {},
  handler: async () => ({
    provider: process?.env?.STRIPE_SECRET_KEY?.trim() ? ("stripe" as const) : ("redo" as const),
  }),
});

/**
 * Internal mutation called only from the signature-verified /webhooks/stripe route.
 * Idempotent on the Stripe event id.
 */
export const fulfillStripePayment = internalMutation({
  args: {
    eventId: v.string(),
    sessionId: v.string(),
    campaignId: v.string(),
    amountTotal: v.number(),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    const seen = await ctx.db
      .query("payments")
      .withIndex("by_rawEventId", (q) => q.eq("rawEventId", args.eventId))
      .first();
    if (seen) return { status: "already_processed" as const };

    const campaignId = ctx.db.normalizeId("campaigns", args.campaignId);
    const campaign = campaignId ? await ctx.db.get(campaignId) : null;
    if (!campaignId || !campaign) return { status: "campaign_not_found" as const };

    if (campaign.expectedAmount && args.amountTotal < campaign.expectedAmount) {
      return { status: "amount_mismatch" as const };
    }
    if (campaign.expectedCurrency && args.currency.toUpperCase() !== campaign.expectedCurrency.toUpperCase()) {
      return { status: "currency_mismatch" as const };
    }

    const row = await ctx.db
      .query("payments")
      .withIndex("by_stripeSessionId", (q) => q.eq("stripeSessionId", args.sessionId))
      .first();
    if (row && row.status === "paid") return { status: "already_processed" as const };

    if (row) {
      await ctx.db.patch(row._id, {
        status: "paid",
        rawEventId: args.eventId,
        amount: args.amountTotal,
        currency: args.currency.toUpperCase(),
      });
    } else {
      await ctx.db.insert("payments", {
        campaignId,
        provider: "stripe",
        stripeSessionId: args.sessionId,
        amount: args.amountTotal,
        currency: args.currency.toUpperCase(),
        status: "paid",
        rawEventId: args.eventId,
      });
    }

    // Start the clock at payment time, preserving the purchased duration.
    const duration = Math.max(campaign.endsAt - campaign.startsAt, 0);
    const now = Date.now();
    await ctx.db.patch(campaignId, {
      status: "active",
      startsAt: now,
      endsAt: now + duration,
    });
    return { status: "activated" as const };
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
 * Internal mutation called strictly via /redo-webhook upon verified HMAC signature.
 * CONTRACT.md Phase 3 ground rule: only a verified REDO webhook activates a paid feature.
 */
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
