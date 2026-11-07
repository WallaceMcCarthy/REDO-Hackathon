import { defineTable } from "convex/server";
import { v } from "convex/values";

const numberOrNull = v.union(v.number(), v.null());
/** One row per public assessor parcel. No owner fields are fetched or stored. */
export const assessorRowValidator = v.object({
  id: v.string(), cityId: v.string(), county: v.string(), address: v.union(v.string(), v.null()),
  lat: v.number(), lng: v.number(), value: v.number(), sqft: numberOrNull, yearBuilt: numberOrNull,
  units: numberOrNull, propertyType: v.string(), asOf: v.string(),
});
export const assessorTables = {
  assessorListings: defineTable(assessorRowValidator)
    .index("by_listingId", ["id"])
    .index("by_city_value", ["cityId", "value", "id"]),
};
