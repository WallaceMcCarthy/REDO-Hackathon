import { defineTable } from "convex/server";
import { v } from "convex/values";

export const previewStatus = v.union(v.literal("ok"), v.literal("no_image"), v.literal("error"));

/** Spread into the central schema. One cached Microlink unfurl per listing. */
export const zillowPreviewTables = {
  zillowPreviews: defineTable({
    listingId: v.string(),
    requestUrl: v.string(),
    pageUrl: v.union(v.string(), v.null()),
    imageUrl: v.union(v.string(), v.null()),
    title: v.union(v.string(), v.null()),
    fetchedAt: v.number(),
    status: previewStatus,
  }).index("by_listingId", ["listingId"]).index("by_fetchedAt", ["fetchedAt"]),
};
