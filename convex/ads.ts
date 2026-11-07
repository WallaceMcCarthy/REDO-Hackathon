import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { campaignCategoryValidator } from "./adsSchema";
import type { AdCategory } from "./lib/adCategories";
import { getOptionalUserId, requireUserId } from "./lib/auth";
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

const MAX_LIVE_UNPAID_CAMPAIGNS = 5;

/** No-payment publishing: payment no longer limits abuse here, so the cap and the activation share one transaction. */
export const publishCampaign = internalMutation({
  args: { userId: v.id("users"), ...campaignArgs },
  handler: async (ctx, { userId, ...args }) => {
    const now = Date.now();
    const mine = await ctx.db
      .query("campaigns")
      .withIndex("by_advertiser", (q) => q.eq("advertiserUserId", userId))
      .collect();
    if (mine.filter((c) => c.status === "active" && c.endsAt > now).length >= MAX_LIVE_UNPAID_CAMPAIGNS) {
      throw new ConvexError(
        `You already have ${MAX_LIVE_UNPAID_CAMPAIGNS} live ads. Wait for one to end before publishing another.`,
      );
    }
    // The insert just set startsAt to now and endsAt to now plus the duration, as fulfillStripePayment would.
    const { campaignId } = await insertPendingCampaign(ctx, userId, args);
    await ctx.db.patch(campaignId, { status: "active" });
    return campaignId;
  },
});

/**
 * Entry point for the advertiser form. Stripe checkout when STRIPE_SECRET_KEY is set; otherwise the
 * ad goes live at once with no payment row. The Stripe amount is computed server-side.
 */
export const createCheckout = action({
  args: campaignArgs,
  handler: async (
    ctx,
    args,
  ): Promise<{ campaignId: string; checkoutUrl: string; amount: number; provider: "none" | "stripe" }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required");

    const client = selectPaymentClient();
    if (client.provider !== "stripe") {
      const campaignId: Id<"campaigns"> = await ctx.runMutation(internal.ads.publishCampaign, { userId, ...args });
      return { campaignId: String(campaignId), checkoutUrl: "/#/advertise", amount: 0, provider: "none" };
    }

    const created: { campaignId: Id<"campaigns">; amount: number; title: string; durationDays: number } =
      await ctx.runMutation(internal.ads.createPendingCampaign, { userId, ...args });

    const session = await client.createCheckoutSession({
      campaignId: String(created.campaignId),
      amount: created.amount,
      currency: "USD",
      title: `${created.title}, ${args.kind}`,
      description: `Utah Fit advertising sponsorship (${created.durationDays} days)`,
      successUrl: `${siteUrl()}/#ads?paid={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${siteUrl()}/#ads?canceled=1`,
    });

    await ctx.runMutation(internal.ads.recordCheckoutSession, {
      campaignId: created.campaignId,
      provider: "stripe",
      sessionId: session.sessionId,
      amount: created.amount,
      currency: "USD",
    });

    return {
      campaignId: String(created.campaignId),
      checkoutUrl: session.checkoutUrl,
      amount: created.amount,
      provider: client.provider,
    };
  },
});

/** Public flag so the UI knows whether publishing goes through Stripe or needs no payment. */
export const paymentProvider = query({
  args: {},
  handler: async () => ({
    provider: process?.env?.STRIPE_SECRET_KEY?.trim() ? ("stripe" as const) : ("none" as const),
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

    if (!campaign.advertiserUserId) {
      // The advertiser deleted their account mid-checkout: keep the money on record, never go live.
      return { status: "recorded_without_activation" as const };
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

/** Owner-scoped lookup of the campaign tied to a Stripe session; null unless the caller owns it. */
export const getOwnedCheckout = internalQuery({
  args: { userId: v.id("users"), sessionId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("payments")
      .withIndex("by_stripeSessionId", (q) => q.eq("stripeSessionId", args.sessionId))
      .first();
    if (!row) return null;
    const campaign = await ctx.db.get(row.campaignId);
    if (!campaign || campaign.advertiserUserId !== args.userId) return null;
    return { campaignId: String(campaign._id), campaignStatus: campaign.status };
  },
});

const SESSION_ID_RE = /^cs_(test|live)_[A-Za-z0-9]+$/;

/**
 * Webhook-free confirmation: the client returns from Checkout and we ask Stripe directly
 * (with the secret key) whether the session is paid, then fulfill idempotently.
 */
export const confirmCheckout = action({
  args: { sessionId: v.string() },
  handler: async (
    ctx,
    { sessionId },
  ): Promise<{ status: "active" | "unpaid" | "not_found" | "error" }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required");
    if (!SESSION_ID_RE.test(sessionId)) throw new Error("Invalid session id");

    const owned = await ctx.runQuery(internal.ads.getOwnedCheckout, { userId, sessionId });
    if (!owned) return { status: "not_found" };
    if (owned.campaignStatus === "active") return { status: "active" };

    const key = process?.env?.STRIPE_SECRET_KEY?.trim();
    if (!key) return { status: "error" };

    let session: any;
    try {
      const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return { status: "error" };
      session = await res.json();
    } catch {
      return { status: "error" };
    }

    if (session?.payment_status !== "paid") return { status: "unpaid" };
    const ref = session.metadata?.campaignId ?? session.client_reference_id;
    if (ref !== owned.campaignId || (session.id !== undefined && session.id !== sessionId)) {
      return { status: "error" };
    }

    const r = await ctx.runMutation(internal.ads.fulfillStripePayment, {
      eventId: `confirm:${sessionId}`,
      sessionId,
      campaignId: owned.campaignId,
      amountTotal: Number(session.amount_total ?? 0),
      currency: String(session.currency ?? ""),
    });
    if (r.status === "activated" || r.status === "already_processed") return { status: "active" };
    return { status: "error" };
  },
});

const MAX_EVENTS_PER_CAMPAIGN_HOUR = 600;
const VIEWER_KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;
const EVENT_RETENTION_HOURS = 24 * 14;

async function hashViewerKey(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function recordAdEvent(
  ctx: MutationCtx,
  campaignId: Id<"campaigns">,
  kind: "impression" | "click",
  clientViewerKey: string,
) {
  if (!VIEWER_KEY_RE.test(clientViewerKey)) throw new Error("Invalid viewer key");
  const userId = await getOptionalUserId(ctx);
  const viewerKey = await hashViewerKey(userId ? `user:${userId}` : `anon:${clientViewerKey}`);

  const campaign = await ctx.db.get(campaignId);
  if (!campaign) return;
  const now = Date.now();
  if (campaign.status !== "active" || campaign.endsAt <= now) return;
  // Self-view metric inflation prevention
  if (userId && campaign.advertiserUserId === userId) return;

  const bucket = Math.floor(now / 3600000);
  const expired = await ctx.db.query("adEvents")
    .withIndex("by_campaign_kind_bucket", q => q.eq("campaignId", campaignId).eq("kind", kind).lt("bucket", bucket - EVENT_RETENTION_HOURS))
    .collect();
  await Promise.all(expired.map(event => ctx.db.delete(event._id)));
  const existing = await ctx.db
    .query("adEvents")
    .withIndex("by_campaign_kind_viewer_bucket", (q) =>
      q.eq("campaignId", campaignId).eq("kind", kind).eq("viewerKey", viewerKey).eq("bucket", bucket),
    )
    .first();
  if (existing) return;

  const inHour = await ctx.db
    .query("adEvents")
    .withIndex("by_campaign_kind_bucket", (q) =>
      q.eq("campaignId", campaignId).eq("kind", kind).eq("bucket", bucket),
    )
    .take(MAX_EVENTS_PER_CAMPAIGN_HOUR);
  if (inHour.length >= MAX_EVENTS_PER_CAMPAIGN_HOUR) return;

  await ctx.db.insert("adEvents", { campaignId, kind, viewerKey, bucket });
  if (kind === "impression") {
    await ctx.db.patch(campaignId, { impressions: (campaign.impressions || 0) + 1 });
  } else {
    await ctx.db.patch(campaignId, { clicks: (campaign.clicks || 0) + 1 });
  }
}

export const recordImpression = mutation({
  args: { campaignId: v.id("campaigns"), viewerKey: v.string() },
  handler: async (ctx, args) => recordAdEvent(ctx, args.campaignId, "impression", args.viewerKey),
});

export const recordClick = mutation({
  args: { campaignId: v.id("campaigns"), viewerKey: v.string() },
  handler: async (ctx, args) => recordAdEvent(ctx, args.campaignId, "click", args.viewerKey),
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
