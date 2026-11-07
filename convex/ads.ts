import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { campaignCategoryValidator, campaignKindValidator } from "./adsSchema";
import type { AdCategory } from "./lib/adCategories";
import { getOptionalUserId, requireUserId } from "./lib/auth";
import { redoClient, selectPaymentClient } from "./lib/payments";
import { isInUtah, nearestTown, UTAH_BOUNDS } from "./lib/adLocation";
import { DEFAULT_AD_DAYS, FREE_AD_DAYS, priceCents, type CampaignKind } from "./lib/pricing";

declare const process: { env?: Record<string, string | undefined> } | undefined;

const MAX_PUBLIC_PINS = 8;
const MAX_PUBLIC_FEATURED = 3;
const DAY_MS = 24 * 3600 * 1000;
// shortcut: a read range stops at its newest 100 rows of any status, add a status-and-town index if one town outgrows that.
const READ_LIMIT = 100;
// Hand-written samples are seeded last, so the pin pool covers all 26 of them, REDO included, plus some generated ones.
const STATEWIDE_PIN_POOL = 48;
const STATEWIDE_FEATURED_POOL = 12;

/**
 * Validates destination URLs:
 * 1. Must parse cleanly with new URL()
 * 2. Must use strictly HTTPS protocol (no javascript:, data:, http:, etc.)
 * 3. Enforces reasonable length bound (<= 500 chars)
 */
export function validateHttpsUrl(rawUrl: string, label = "Destination URL"): string {
  const trimmed = (rawUrl || "").trim();
  const plain = label[0].toLowerCase() + label.slice(1);
  if (!trimmed) {
    throw new ConvexError(`Enter a ${plain}`);
  }
  if (trimmed.length > 500) {
    throw new ConvexError(`${label} exceeds maximum length of 500 characters`);
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ConvexError(`Enter a valid ${plain}`);
  }
  if (parsed.protocol !== "https:") {
    throw new ConvexError(`${label} must start with https://`);
  }
  return parsed.toString();
}

type Campaign = Doc<"campaigns">;

/** The newest rows for a town plus the town-less ones, so a town query costs the same however many towns have ads. */
async function townRows(ctx: QueryCtx, cityId: string) {
  const newest = (id: string | undefined) =>
    ctx.db.query("campaigns").withIndex("by_cityId", (q) => q.eq("cityId", id)).order("desc").take(READ_LIMIT);
  return (await Promise.all([newest(cityId), newest(undefined)])).flat();
}

/** Real ads have an advertiser, so this index reaches them however many samples were seeded after them. */
async function statewideRows(ctx: QueryCtx, samplePool: Campaign[]) {
  const real = await ctx.db
    .query("campaigns")
    .withIndex("by_advertiser", (q) => q.gt("advertiserUserId", undefined))
    .order("desc")
    .take(READ_LIMIT);
  return [...real, ...samplePool.filter((c) => c.isSample)];
}

/** A stable slot per sample per day, so the shown samples change daily without changing between reads. */
function dailySlot(campaign: Campaign, day: number) {
  // CONTRACT.md requires the Apply to REDO ad, the one sample that links outside example.com.
  if (!campaign.url.startsWith("https://example.com/")) return -1;
  let hash = day;
  for (let i = 0; i < campaign._id.length; i++) hash = Math.imul(hash ^ campaign._id.charCodeAt(i), 16777619);
  return hash >>> 0;
}

/** Live ads of the given kinds: real before sample, then local before town-less. Real ads run newest first, samples rotate. */
function pickPublic(rows: Campaign[], kinds: Campaign["kind"][], cityId: string | undefined, max: number) {
  const now = Date.now();
  const day = Math.floor(now / DAY_MS);
  const tier = (c: Campaign) => (c.isSample ? 2 : 0) + (cityId && c.cityId === cityId ? 0 : 1);
  return rows
    .filter((c) => c.status === "active" && c.endsAt >= now && kinds.includes(c.kind))
    .sort((a, b) => tier(a) - tier(b) || (a.isSample ? dailySlot(a, day) - dailySlot(b, day) : b.startsAt - a.startsAt))
    .slice(0, max);
}

export const getActivePins = query({
  args: {
    cityId: v.optional(v.string()),
  },
  handler: async (ctx, { cityId }) => {
    const rows = cityId
      ? await townRows(ctx, cityId)
      : await statewideRows(
          ctx,
          await ctx.db.query("campaigns").withIndex("by_status", (q) => q.eq("status", "active")).order("desc").take(STATEWIDE_PIN_POOL),
        );
    return pickPublic(rows, ["pin", "job"], cityId, MAX_PUBLIC_PINS);
  },
});

export const getActiveFeatured = query({
  args: {
    cityId: v.optional(v.string()),
  },
  handler: async (ctx, { cityId }) => {
    const rows = cityId
      ? await townRows(ctx, cityId)
      : await statewideRows(
          ctx,
          await ctx.db
            .query("campaigns")
            .withIndex("by_status_kind", (q) => q.eq("status", "active").eq("kind", "featured"))
            .order("desc")
            .take(STATEWIDE_FEATURED_POOL),
        );
    return pickPublic(rows, ["featured"], cityId, MAX_PUBLIC_FEATURED);
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
  kind: v.optional(campaignKindValidator),
  category: v.optional(campaignCategoryValidator),
  title: v.optional(v.string()),
  body: v.string(),
  url: v.string(),
  imageUrl: v.optional(v.string()),
  lat: v.optional(v.number()),
  lng: v.optional(v.number()),
  listingId: v.optional(v.string()),
  cityId: v.optional(v.string()),
  durationDays: v.optional(v.number()),
};

type CampaignInput = {
  kind?: CampaignKind;
  category?: AdCategory;
  title?: string;
  body: string;
  url: string;
  imageUrl?: string;
  lat?: number;
  lng?: number;
  listingId?: string;
  cityId?: string;
  durationDays?: number;
};

const MAX_TITLE = 80;

/** The form only asks for a message, so the name shown in lists and on the Stripe receipt comes from it. */
function titleFromMessage(body: string) {
  const line = body.replace(/\s+/g, " ");
  return line.length <= MAX_TITLE ? line : `${line.slice(0, MAX_TITLE - 1).trimEnd()}…`;
}

/** Validate client input and insert a pending_payment campaign priced server-side. */
async function insertPendingCampaign(ctx: MutationCtx, userId: Id<"users">, args: CampaignInput) {
  // 1. Body validation
  const body = args.body.trim();
  if (body.length < 5 || body.length > 300) {
    throw new ConvexError("Campaign description must be between 5 and 300 characters");
  }

  // 2. Title validation
  const title = args.title?.trim() || titleFromMessage(body);
  if (title.length < 3 || title.length > MAX_TITLE) {
    throw new ConvexError(`Campaign title must be between 3 and ${MAX_TITLE} characters`);
  }

  // 3. Strict HTTPS URL validation (prevents stored XSS attacks)
  const validUrl = validateHttpsUrl(args.url);
  const imageUrl = args.imageUrl?.trim() ? validateHttpsUrl(args.imageUrl, "Image URL") : undefined;

  // 4. Duration bounds
  const durationDays = Math.round(args.durationDays ?? DEFAULT_AD_DAYS);
  if (durationDays < 1 || durationDays > 90) {
    throw new ConvexError("Campaign duration must be between 1 and 90 days");
  }

  // 5. Every ad is a spot on the map with an image
  const { lat, lng } = args;
  if (lat === undefined || lng === undefined) {
    throw new ConvexError("Choose a location on the map");
  }
  if (!isInUtah(lat, lng)) {
    throw new ConvexError(
      `Location coordinates must be within Utah bounds (${UTAH_BOUNDS.minLat}° to ${UTAH_BOUNDS.maxLat}° N, ${UTAH_BOUNDS.minLng}° to ${UTAH_BOUNDS.maxLng}° W)`
    );
  }
  if (!imageUrl) {
    throw new ConvexError("Enter an image URL");
  }

  // 6. A campaign aimed at an unknown town would be paid for and shown nowhere
  const { cityId: chosenCityId } = args;
  if (chosenCityId && !(await ctx.db.query("cities").withIndex("by_cityId", (q) => q.eq("id", chosenCityId)).unique())) {
    throw new ConvexError("Choose a target town from the list");
  }
  // Without a town the ad would run on every town page, so the pin picks the page it belongs on.
  const cityId = chosenCityId ?? nearestTown(await ctx.db.query("cities").collect(), lat, lng)?.id;

  const kind = args.kind ?? "pin";
  const now = Date.now();
  const durationMs = durationDays * 24 * 3600 * 1000;
  const amount = priceCents(kind, durationDays);

  const campaignId = await ctx.db.insert("campaigns", {
    advertiserUserId: userId,
    kind,
    category: args.category ?? "other",
    title,
    body,
    url: validUrl,
    imageUrl,
    lat,
    lng,
    listingId: args.listingId,
    cityId,
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

  return { campaignId, amount, title, durationDays, kind };
}

const siteUrl = () => (process?.env?.SITE_URL || "https://cmascope.com").replace(/\/+$/, "");

/** REDO sandbox path (kept as the alternate provider). */
export const createCampaign = mutation({
  args: campaignArgs,
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const { campaignId, amount, title, durationDays, kind } = await insertPendingCampaign(ctx, userId, args);

    const session = await redoClient.createCheckoutSession({
      campaignId: String(campaignId),
      amount,
      currency: "USD",
      title: `${kind.toUpperCase()} Campaign: ${title}`,
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
    return insertPendingCampaign(ctx, userId, args);
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
const MAX_FREE_ADS_PER_DAY = 3;

/** No-payment publishing: payment no longer limits abuse here, so the cap and the activation share one transaction. */
export const publishCampaign = internalMutation({
  args: { userId: v.id("users"), free: v.optional(v.boolean()), ...campaignArgs },
  handler: async (ctx, { userId, free, ...args }) => {
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
    // Ended free ads still count, or an advertiser could cycle them. An expected amount of 0 is what marks a free ad.
    if (free && mine.filter((c) => c.expectedAmount === 0 && c.startsAt > now - DAY_MS).length >= MAX_FREE_ADS_PER_DAY) {
      throw new ConvexError(`You can publish ${MAX_FREE_ADS_PER_DAY} free ads every 24 hours. Try again later or choose the paid option.`);
    }
    // The insert just set startsAt to now and endsAt to now plus the duration, as fulfillStripePayment would.
    // A free ad takes nothing from the client but its content, so it cannot ask for a bigger placement or a longer run.
    const { campaignId } = await insertPendingCampaign(ctx, userId, free ? { ...args, kind: "pin", durationDays: FREE_AD_DAYS } : args);
    await ctx.db.patch(campaignId, free ? { status: "active", expectedAmount: 0 } : { status: "active" });
    // No-ops when moderation is disabled (#99); a free ad can be briefly active until this runs, then pulled back
    // to pending_review if judged hold/reject. Scheduled, not awaited. Paid Stripe campaigns aren't moderated here.
    await ctx.scheduler.runAfter(0, internal.moderation.moderateCampaign, { campaignId });
    return campaignId;
  },
});

/**
 * Entry point for the advertiser form. Stripe checkout when STRIPE_SECRET_KEY is set; otherwise, or for
 * a free ad, the ad goes live at once with no payment row. The Stripe amount is computed server-side.
 * `free` stays out of campaignArgs so the pending-payment paths can never see it.
 */
export const createCheckout = action({
  args: { free: v.optional(v.boolean()), ...campaignArgs },
  handler: async (
    ctx,
    { free, ...args },
  ): Promise<{ campaignId: string; checkoutUrl: string; amount: number; provider: "none" | "stripe" }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required");

    const client = selectPaymentClient();
    if (free || client.provider !== "stripe") {
      const campaignId: Id<"campaigns"> = await ctx.runMutation(internal.ads.publishCampaign, { userId, free, ...args });
      return { campaignId: String(campaignId), checkoutUrl: "/#/advertise", amount: 0, provider: "none" };
    }

    const created: { campaignId: Id<"campaigns">; amount: number; title: string; durationDays: number; kind: CampaignKind } =
      await ctx.runMutation(internal.ads.createPendingCampaign, { userId, ...args });

    const session = await client.createCheckoutSession({
      campaignId: String(created.campaignId),
      amount: created.amount,
      currency: "USD",
      title: `${created.title}, ${created.kind}`,
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

export const getPendingCampaignForCheckout = internalQuery({
  args: { userId: v.id("users"), campaignId: v.id("campaigns") },
  handler: async (ctx, { userId, campaignId }) => {
    const campaign = await ctx.db.get(campaignId);
    if (!campaign || campaign.advertiserUserId !== userId || campaign.status !== "pending_payment") return null;
    return {
      campaignId: campaign._id,
      amount: campaign.expectedAmount ?? 0,
      title: campaign.title,
      kind: campaign.kind,
      durationDays: Math.max(1, Math.round((campaign.endsAt - campaign.startsAt) / 86400000)),
    };
  },
});

/** Create a fresh Stripe session for an existing pending campaign without duplicating the campaign. */
export const resumeCheckout = action({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, { campaignId }): Promise<{ checkoutUrl: string; amount: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required");
    const pending = await ctx.runQuery(internal.ads.getPendingCampaignForCheckout, { userId, campaignId });
    if (!pending) throw new ConvexError("This campaign cannot resume checkout");
    const client = selectPaymentClient();
    if (client.provider !== "stripe") throw new ConvexError("Stripe checkout is not available");
    const session = await client.createCheckoutSession({
      campaignId: String(campaignId),
      amount: pending.amount,
      currency: "USD",
      title: `${pending.title}, ${pending.kind}`,
      description: `Utah Fit advertising sponsorship (${pending.durationDays} days)`,
      successUrl: `${siteUrl()}/#ads?paid={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${siteUrl()}/#ads?canceled=1`,
    });
    await ctx.runMutation(internal.ads.recordCheckoutSession, {
      campaignId, provider: "stripe", sessionId: session.sessionId, amount: pending.amount, currency: "USD",
    });
    return { checkoutUrl: session.checkoutUrl, amount: pending.amount };
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
  surface: "results_featured" | "town_highlights" | "unknown",
  pageTownId?: string,
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
  const day = Math.floor(now / 86400000);
  const daily = await ctx.db.query("campaignDailyStats")
    .withIndex("by_campaign_day_surface_town", q => q.eq("campaignId", campaignId).eq("day", day).eq("surface", surface).eq("pageTownId", pageTownId))
    .first();
  if (daily) {
    await ctx.db.patch(daily._id, kind === "impression" ? { impressions: daily.impressions + 1 } : { clicks: daily.clicks + 1 });
  } else {
    await ctx.db.insert("campaignDailyStats", {
      campaignId, day, surface, pageTownId,
      impressions: kind === "impression" ? 1 : 0,
      clicks: kind === "click" ? 1 : 0,
    });
  }
  if (kind === "impression") {
    await ctx.db.patch(campaignId, { impressions: (campaign.impressions || 0) + 1 });
  } else {
    await ctx.db.patch(campaignId, { clicks: (campaign.clicks || 0) + 1 });
  }
}

export const recordImpression = mutation({
  args: { campaignId: v.id("campaigns"), viewerKey: v.string(), surface: v.optional(v.union(v.literal("results_featured"), v.literal("town_highlights"))), pageTownId: v.optional(v.string()) },
  handler: async (ctx, args) => recordAdEvent(ctx, args.campaignId, "impression", args.viewerKey, args.surface ?? "unknown", args.pageTownId),
});

export const recordClick = mutation({
  args: { campaignId: v.id("campaigns"), viewerKey: v.string(), surface: v.optional(v.union(v.literal("results_featured"), v.literal("town_highlights"))), pageTownId: v.optional(v.string()) },
  handler: async (ctx, args) => recordAdEvent(ctx, args.campaignId, "click", args.viewerKey, args.surface ?? "unknown", args.pageTownId),
});

export const listMyCampaignStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const campaigns = await ctx.db.query("campaigns").withIndex("by_advertiser", q => q.eq("advertiserUserId", userId)).collect();
    const rows = [];
    for (const campaign of campaigns) {
      const stats = await ctx.db.query("campaignDailyStats").withIndex("by_campaign_day", q => q.eq("campaignId", campaign._id)).collect();
      rows.push(...stats);
    }
    return rows;
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
