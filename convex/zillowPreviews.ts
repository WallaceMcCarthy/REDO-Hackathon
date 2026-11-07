import { v } from "convex/values";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { previewStatus } from "./zillowPreviewsSchema";
import {
  DAY_MS, FETCH_TIMEOUT_MS, decideFetch, microlinkRequest, parseMicrolink, zillowUrl,
  type PreviewFields,
} from "./lib/zillow";

declare const process: { env: Record<string, string | undefined> };

export interface PreviewResult extends PreviewFields {
  listingId: string;
  requestUrl: string;
  fetchedAt: number;
}

const CALLER_WINDOW_MS = 60 * 60 * 1000;
const CALLER_WINDOW_CAP = 10;

/** Cached preview row for a listing, or null. */
export const get = query({
  args: { listingId: v.string() },
  handler: async (ctx, { listingId }) =>
    ctx.db.query("zillowPreviews").withIndex("by_listingId", q => q.eq("listingId", listingId)).first(),
});

export const prepare = internalQuery({
  args: { listingId: v.string(), now: v.number() },
  handler: async (ctx, { listingId, now }) => {
    const listing = await ctx.db.query("listings").withIndex("by_listingId", q => q.eq("id", listingId)).first();
    if (!listing) return null;
    const city = await ctx.db.query("cities").withIndex("by_cityId", q => q.eq("id", listing.cityId)).first();
    const row = await ctx.db.query("zillowPreviews").withIndex("by_listingId", q => q.eq("listingId", listingId)).first();
    const recent = await ctx.db.query("zillowPreviews").withIndex("by_fetchedAt", q => q.gt("fetchedAt", now - DAY_MS)).collect();
    return { address: listing.address, kind: listing.kind, cityName: city?.name, row, callsLast24h: recent.length };
  },
});

export const store = internalMutation({
  args: {
    listingId: v.string(), requestUrl: v.string(), pageUrl: v.union(v.string(), v.null()),
    imageUrl: v.union(v.string(), v.null()), title: v.union(v.string(), v.null()),
    fetchedAt: v.number(), status: previewStatus,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("zillowPreviews").withIndex("by_listingId", q => q.eq("listingId", args.listingId)).first();
    if (existing) await ctx.db.replace(existing._id, args);
    else await ctx.db.insert("zillowPreviews", args);
  },
});

/** Atomically reserve one cache-miss request for a viewer's hourly quota. */
export const reserveCallerRequest = internalMutation({
  args: { viewerKey: v.string(), now: v.number() },
  handler: async (ctx, { viewerKey, now }) => {
    const recent = await ctx.db
      .query("zillowPreviewRequests")
      .withIndex("by_viewerKey_requestedAt", q => q.eq("viewerKey", viewerKey).gte("requestedAt", now - CALLER_WINDOW_MS))
      .take(CALLER_WINDOW_CAP);
    if (recent.length >= CALLER_WINDOW_CAP) return false;
    await ctx.db.insert("zillowPreviewRequests", { viewerKey, requestedAt: now });
    return true;
  },
});

/** Fetch (at most once per listing, within a daily budget) the Zillow page's Open Graph preview via Microlink. */
export const fetch = action({
  args: { listingId: v.string(), viewerKey: v.string() },
  handler: async (ctx, { listingId, viewerKey }): Promise<PreviewResult | null> => {
    if (!viewerKey || viewerKey.length > 128) throw new Error("Invalid preview viewer key");
    const now = Date.now();
    const apiKey = process.env.MICROLINK_API_KEY || undefined;
    const info = await ctx.runQuery(internal.zillowPreviews.prepare, { listingId, now });
    if (!info) return null;
    const requestUrl = zillowUrl(info.address, info.cityName, info.kind);
    const decision = decideFetch({ row: info.row, now, callsLast24h: info.callsLast24h, hasApiKey: !!apiKey });
    if (decision === 'cached' && info.row) {
      const { _id, _creationTime, ...rest } = info.row;
      return rest;
    }
    const fail: PreviewFields = { pageUrl: null, imageUrl: null, title: null, status: 'error' };
    // Budget exhausted: report an error without calling out or storing (so it retries once budget frees up).
    if (decision === 'budget_exhausted') return { listingId, requestUrl, fetchedAt: now, ...fail };
    const identity = await ctx.auth.getUserIdentity();
    const callerKey = identity ? `user:${identity.subject}` : `anon:${viewerKey}`;
    const allowed = await ctx.runMutation(internal.zillowPreviews.reserveCallerRequest, { viewerKey: callerKey, now });
    if (!allowed) return { listingId, requestUrl, fetchedAt: now, ...fail };

    let fields = fail;
    try {
      const req = microlinkRequest(requestUrl, apiKey);
      const res = await globalThis.fetch(req.url, { headers: req.headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (res.ok) fields = parseMicrolink(await res.json());
    } catch {
      fields = fail;
    }
    const result: PreviewResult = { listingId, requestUrl, fetchedAt: Date.now(), ...fields };
    await ctx.runMutation(internal.zillowPreviews.store, result);
    return result;
  },
});
