import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
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
});
