import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { redoClient } from "./lib/payments";

export const getActivePins = query({
  args: {
    cityId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const rows = (await (ctx.db.query as any)("campaigns").collect()) as any[];

    return rows.filter((c) => {
      if (c.status !== "active") return false;
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
    const rows = (await (ctx.db.query as any)("campaigns").collect()) as any[];

    return rows.filter((c) => {
      if (c.status !== "active") return false;
      if (c.kind !== "featured") return false;
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
    const rows = (await (ctx.db.query as any)("campaigns").collect()) as any[];
    return rows
      .filter((c) => c.advertiserUserId === userId)
      .sort((a, b) => b.startsAt - a.startsAt);
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

    const campaignId = await (ctx.db.insert as any)("campaigns", {
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
    });

    const session = await redoClient.createCheckoutSession({
      campaignId: String(campaignId),
      amount,
      currency: "USD",
      title: `${args.kind.toUpperCase()} Campaign: ${args.title}`,
      description: `Utah Fit advertising sponsorship (${args.durationDays} days)`,
      successUrl: `${process.env.SITE_URL || "https://cmascope.com"}/ads/success`,
      cancelUrl: `${process.env.SITE_URL || "https://cmascope.com"}/ads/cancel`,
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
    campaignId: v.string(),
  },
  handler: async (ctx, args) => {
    const campaign = await (ctx.db.get as any)(args.campaignId);
    if (!campaign) return;
    await (ctx.db.patch as any)(args.campaignId, {
      impressions: (campaign.impressions || 0) + 1,
    });
  },
});

export const recordClick = mutation({
  args: {
    campaignId: v.string(),
  },
  handler: async (ctx, args) => {
    const campaign = await (ctx.db.get as any)(args.campaignId);
    if (!campaign) return;
    await (ctx.db.patch as any)(args.campaignId, {
      clicks: (campaign.clicks || 0) + 1,
    });
  },
});

export const fulfillRedoPayment = internalMutation({
  args: {
    campaignId: v.string(),
    redoPaymentId: v.string(),
    amount: v.number(),
    currency: v.string(),
    rawEventId: v.string(),
  },
  handler: async (ctx, args) => {
    const payments = (await (ctx.db.query as any)("payments").collect()) as any[];
    const existing = payments.find((p) => p.rawEventId === args.rawEventId);

    if (existing) {
      return { status: "already_processed" };
    }

    await (ctx.db.insert as any)("payments", {
      campaignId: args.campaignId,
      redoPaymentId: args.redoPaymentId,
      amount: args.amount,
      currency: args.currency,
      status: "succeeded",
      rawEventId: args.rawEventId,
    });

    await (ctx.db.patch as any)(args.campaignId, {
      status: "active",
      redoPaymentId: args.redoPaymentId,
    });

    return { status: "activated" };
  },
});
