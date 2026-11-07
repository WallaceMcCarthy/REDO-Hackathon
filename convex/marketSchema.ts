import { defineTable } from "convex/server";
import { v } from "convex/values";

const numberOrNull = v.union(v.number(), v.null());
const stringOrNull = v.union(v.string(), v.null());
export const marketFields = {
  rcId: v.string(), market: v.union(v.literal("for_sale"), v.literal("for_rent")),
  address: stringOrNull, city: stringOrNull, zip: stringOrNull,
  lat: numberOrNull, lng: numberOrNull, price: numberOrNull, beds: numberOrNull,
  baths: numberOrNull, sqft: numberOrNull, yearBuilt: numberOrNull, propertyType: stringOrNull,
  listedDate: stringOrNull, daysOnMarket: numberOrNull,
};
export const marketRowValidator = v.object({ ...marketFields, cityId: v.optional(stringOrNull) });
export const marketTables = {
  marketListings: defineTable({ ...marketFields, cityId: stringOrNull, residential: v.boolean(), sortYearBuilt: v.number(), importedAt: v.number() })
    .index("by_city_market_price", ["cityId", "market", "price"])
    .index("by_market_price", ["market", "price"])
    .index("by_rcId", ["rcId"])
    .index("by_market_rcId", ["market", "rcId"])
    .index("by_city_market_residential_price", ["cityId", "market", "residential", "price", "rcId"])
    .index("by_city_market_residential_year", ["cityId", "market", "residential", "sortYearBuilt", "rcId"]),
  marketListingStats: defineTable({ cityId: stringOrNull, market: v.union(v.literal("for_sale"), v.literal("for_rent")), prices: v.array(v.number()),
    yearOrder: v.optional(v.array(v.object({ rcId: v.string(), price: v.number(), yearBuilt: v.number() }))), updatedAt: v.number() })
    .index("by_city_market", ["cityId", "market"]).index("by_market", ["market"]),
};
