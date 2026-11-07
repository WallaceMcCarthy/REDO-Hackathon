/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as ads from "../ads.js";
import type * as adsSchema from "../adsSchema.js";
import type * as auth from "../auth.js";
import type * as cities from "../cities.js";
import type * as cleanup from "../cleanup.js";
import type * as feedSchema from "../feedSchema.js";
import type * as http from "../http.js";
import type * as lib_adCategories from "../lib/adCategories.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_feed from "../lib/feed.js";
import type * as lib_listingSearch from "../lib/listingSearch.js";
import type * as lib_listings from "../lib/listings.js";
import type * as lib_payments from "../lib/payments.js";
import type * as lib_pricing from "../lib/pricing.js";
import type * as lib_roommateRules from "../lib/roommateRules.js";
import type * as lib_roommates from "../lib/roommates.js";
import type * as lib_scoring from "../lib/scoring.js";
import type * as lib_social from "../lib/social.js";
import type * as lib_zillow from "../lib/zillow.js";
import type * as listings from "../listings.js";
import type * as messages from "../messages.js";
import type * as messagesSchema from "../messagesSchema.js";
import type * as metrics from "../metrics.js";
import type * as posts from "../posts.js";
import type * as profiles from "../profiles.js";
import type * as roommateSchema from "../roommateSchema.js";
import type * as roommates from "../roommates.js";
import type * as sampleAds from "../sampleAds.js";
import type * as sampleData from "../sampleData.js";
import type * as search from "../search.js";
import type * as seed from "../seed.js";
import type * as social from "../social.js";
import type * as socialSchema from "../socialSchema.js";
import type * as zillowPreviews from "../zillowPreviews.js";
import type * as zillowPreviewsSchema from "../zillowPreviewsSchema.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  ads: typeof ads;
  adsSchema: typeof adsSchema;
  auth: typeof auth;
  cities: typeof cities;
  cleanup: typeof cleanup;
  feedSchema: typeof feedSchema;
  http: typeof http;
  "lib/adCategories": typeof lib_adCategories;
  "lib/auth": typeof lib_auth;
  "lib/feed": typeof lib_feed;
  "lib/listingSearch": typeof lib_listingSearch;
  "lib/listings": typeof lib_listings;
  "lib/payments": typeof lib_payments;
  "lib/pricing": typeof lib_pricing;
  "lib/roommateRules": typeof lib_roommateRules;
  "lib/roommates": typeof lib_roommates;
  "lib/scoring": typeof lib_scoring;
  "lib/social": typeof lib_social;
  "lib/zillow": typeof lib_zillow;
  listings: typeof listings;
  messages: typeof messages;
  messagesSchema: typeof messagesSchema;
  metrics: typeof metrics;
  posts: typeof posts;
  profiles: typeof profiles;
  roommateSchema: typeof roommateSchema;
  roommates: typeof roommates;
  sampleAds: typeof sampleAds;
  sampleData: typeof sampleData;
  search: typeof search;
  seed: typeof seed;
  social: typeof social;
  socialSchema: typeof socialSchema;
  zillowPreviews: typeof zillowPreviews;
  zillowPreviewsSchema: typeof zillowPreviewsSchema;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
