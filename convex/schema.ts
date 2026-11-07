import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { feedTables } from "./feedSchema";
import { roommateTables } from "./roommateSchema";
import { socialTables } from "./socialSchema";

export default defineSchema({
  ...authTables,
  ...socialTables,
  ...feedTables,
  ...roommateTables,
  profiles: defineTable({
    userId: v.id("users"),
    displayName: v.string(),
    cityId: v.union(v.string(), v.null()),
    moveBy: v.union(v.string(), v.null()),
    budget: v.union(v.number(), v.null()),
    household: v.union(v.number(), v.null()),
    isSample: v.boolean(),
  }).index("by_userId", ["userId"]),
  cities: defineTable({
    id: v.string(),
    name: v.string(),
    county: v.string(),
    lat: v.number(),
    lng: v.number(),
    population: v.number(),
    blurb: v.string(),
  }).index("by_cityId", ["id"]),
  metrics: defineTable({
    id: v.string(),
    label: v.string(),
    category: v.string(),
    unit: v.string(),
    higherIsBetter: v.boolean(),
    description: v.string(),
    source: v.string(),
    sourceUrl: v.string(),
    year: v.number(),
    values: v.record(v.string(), v.number()),
  }).index("by_metricId", ["id"]),
  listings: defineTable({
    id: v.string(),
    cityId: v.string(),
    kind: v.union(v.literal("home"), v.literal("apartment")),
    name: v.union(v.string(), v.null()),
    address: v.union(v.string(), v.null()),
    lat: v.number(),
    lng: v.number(),
    value: v.union(v.number(), v.null()),
    rent: v.union(v.number(), v.null()),
    beds: v.union(v.number(), v.null()),
    sqft: v.union(v.number(), v.null()),
    yearBuilt: v.union(v.number(), v.null()),
    units: v.union(v.number(), v.null()),
    propertyType: v.union(v.string(), v.null()),
    source: v.string(),
    sourceUrl: v.string(),
    year: v.union(v.number(), v.null()),
  }).index("by_cityId", ["cityId"]).index("by_kind", ["kind"]).index("by_listingId", ["id"]),
});
