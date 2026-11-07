import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateHttpsUrl } from "./ads";
import schema from "./schema";
import { AD_CATEGORY_IDS } from "./lib/adCategories";
import { buildSampleAds } from "./sampleAds";
import { SAMPLE_CAMPAIGNS } from "./sampleData";

const TOWN_COUNT = 42;
const NOW = Date.UTC(2026, 10, 6);
const ads = buildSampleAds(NOW);
const all = [...ads, ...SAMPLE_CAMPAIGNS];

describe("sample ads generator", () => {
  it("totals exactly 300 with the hand-written rows and gives every town pins, a job and a featured ad", () => {
    expect(all).toHaveLength(300);
    expect(new Set(all.map((a) => a.cityId)).size).toBe(TOWN_COUNT);
    for (const cityId of new Set(ads.map((a) => a.cityId))) {
      const town = ads.filter((a) => a.cityId === cityId);
      expect(town.filter((a) => a.kind === "pin").length).toBeGreaterThanOrEqual(4);
      expect(town.filter((a) => a.kind === "job").length).toBeGreaterThanOrEqual(1);
      expect(town.filter((a) => a.kind === "featured").length).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps at least 20 ads in every category, spread over many towns", () => {
    for (const category of AD_CATEGORY_IDS) {
      const rows = all.filter((a) => a.category === category);
      expect(rows.length, category).toBeGreaterThanOrEqual(20);
      expect(new Set(rows.map((a) => a.cityId)).size, category).toBeGreaterThanOrEqual(12);
    }
  });

  it("keeps town character: ski shops only in towns listed for them", () => {
    const skiTowns = new Set(ads.filter((a) => /Ski|Snow Shop|Powder Rentals/.test(a.title) && a.kind === "pin").map((a) => a.cityId));
    expect([...skiTowns].sort()).toEqual(["cottonwood-heights", "ogden", "logan", "park-city", "sandy"].sort());
  });

  it("is deterministic and has unique titles and urls", () => {
    expect(buildSampleAds(NOW)).toEqual(ads);
    expect(new Set(ads.map((a) => a.title)).size).toBe(ads.length);
    expect(new Set(ads.map((a) => a.url)).size).toBe(ads.length);
  });

  it("never reuses a title from the hand-written campaigns", () => {
    const hand = new Set(SAMPLE_CAMPAIGNS.map((c) => c.title));
    expect(ads.filter((a) => hand.has(a.title))).toEqual([]);
  });

  it("is valid, fake, in Utah, active across the coming months, with sane stats", () => {
    for (const a of ads) {
      expect(a.isSample).toBe(true);
      expect(AD_CATEGORY_IDS).toContain(a.category);
      expect(a.imageUrl).toBe(`/sample-ads/${a.category}.svg`);
      expect("advertiserUserId" in a).toBe(false);
      expect([a.lat, a.lng, a.impressions, a.clicks].every(Number.isFinite)).toBe(true);
      expect(validateHttpsUrl(a.url)).toContain("https://example.com/");
      expect(a.title.length).toBeGreaterThanOrEqual(3);
      expect(a.title.length).toBeLessThanOrEqual(80);
      expect(a.body.length).toBeLessThanOrEqual(300);
      expect(a.lat).toBeGreaterThan(36.9);
      expect(a.lat).toBeLessThan(42.1);
      expect(a.lng).toBeGreaterThan(-114.1);
      expect(a.lng).toBeLessThan(-108.9);
      expect(a.startsAt).toBeLessThanOrEqual(NOW);
      expect(a.endsAt - NOW).toBeGreaterThan(59 * 24 * 3600 * 1000);
      expect(Number.isInteger(a.impressions) && Number.isInteger(a.clicks)).toBe(true);
      expect(a.impressions).toBeGreaterThan(0);
      const ctr = a.clicks / a.impressions;
      expect(ctr).toBeGreaterThan(0);
      expect(ctr).toBeLessThan(0.1);
      if (a.kind === "job") expect(a.body).toMatch(/Pay \$\d+k?-\$\d+k?\/(hr|yr)/);
    }
  });
});

describe("seedSampleContent", () => {
  it("converges on rerun instead of duplicating", async () => {
    const t = convexTest(schema, {
      "./sampleData.ts": () => import("./sampleData"),
      "./_generated/server.js": () => import("./_generated/server.js"),
    });
    const seed = makeFunctionReference<"mutation">("sampleData:seedSampleContent");
    const total = () => t.run(async (ctx: any) => (await ctx.db.query("campaigns").collect()).length);
    await t.run(async (ctx: any) => {
      for (const id of new Set(SAMPLE_CAMPAIGNS.map((c) => c.cityId)))
        await ctx.db.insert("cities", { id, name: id, county: "x", lat: 40.5, lng: -111.9, population: 1, blurb: "x" });
    });
    await t.mutation(seed as any, {});
    const first = await total();
    await t.mutation(seed as any, {});
    expect(await total()).toBe(first);
    expect(first).toBe(ads.length + SAMPLE_CAMPAIGNS.length);
    const rows = await t.run(async (ctx: any) => ctx.db.query("campaigns").collect());
    expect(rows.every((r: any) => r.isSample && r.status === "active" && !("advertiserUserId" in r))).toBe(true);
    expect(new Set(rows.map((r: any) => r.title)).size).toBe(rows.length);
    const comments = await t.run(async (ctx: any) => ctx.db.query("comments").collect());
    const profiles = await t.run(async (ctx: any) => ctx.db.query("profiles").collect());
    expect(comments.length).toBe(6);
    expect(profiles.length).toBe(6);
    const users = await t.run(async (ctx: any) => ctx.db.query("users").collect());
    expect(users.every((u: any) => u.email.endsWith("@example.com"))).toBe(true);
    expect(profiles.every((p: any) => p.isSample && p.displayName.endsWith("(Sample)"))).toBe(true);
    expect(comments.every((c: any) => profiles.some((p: any) => p.userId === c.userId))).toBe(true);
    expect(rows.some((r: any) => r.title === "Apply to REDO!" && r.kind === "job")).toBe(true);
  });
});

describe("sample listing ads", () => {
  const cities: any[] = JSON.parse(readFileSync("data/cities.json", "utf8"));
  const seed = makeFunctionReference<"mutation">("sampleData:seedSampleContent");
  const importRows = makeFunctionReference<"mutation">("seed:insertMarketListings");
  const search = makeFunctionReference<"query">("listings:search");
  const rank = makeFunctionReference<"query">("search:rank");
  const getListing = makeFunctionReference<"query">("listings:get");
  const weights = { trails: 5 };

  const row = (city: any, i: number, fields: object = {}) => ({
    rcId: `${city.id}-${i}`, market: "for_sale", address: `${100 + i} Fixture St, ${city.name}, UT 84000`, city: city.name, zip: "84000",
    lat: city.lat + i * 0.0001, lng: city.lng, price: 300000 + i * 10000, beds: 3, baths: 2, sqft: 1500, yearBuilt: 2000,
    propertyType: "Single Family", listedDate: "2026-11-01", daysOnMarket: 6, ...fields,
  });

  async function setup(rows: object[]) {
    const t = convexTest(schema, {
      "./sampleData.ts": () => import("./sampleData"),
      "./seed.ts": () => import("./seed"),
      "./marketSeed.ts": () => import("./marketSeed"),
      "./marketSearch.ts": () => import("./marketSearch"),
      "./listings.ts": () => import("./listings"),
      "./search.ts": () => import("./search"),
      "./social.ts": () => import("./social"),
      "./messages.ts": () => import("./messages"),
      "./_generated/server.js": () => import("./_generated/server.js"),
    });
    await t.run(async (ctx: any) => {
      for (const c of cities) await ctx.db.insert("cities", c);
      await ctx.db.insert("metrics", {
        id: "trails", label: "Trails", category: "outdoors", unit: "count", higherIsBetter: true, description: "Fixture", source: "Fixture",
        sourceUrl: "https://example.test", year: 2026, values: Object.fromEntries(cities.map((c, i) => [c.id, i])),
      });
    });
    for (let i = 0; i < rows.length; i += 400) await t.mutation(importRows as any, { rows: rows.slice(i, i + 400) });
    return t;
  }
  const campaigns = (t: any) => t.run((ctx: any) => ctx.db.query("campaigns").collect());
  const rental = (city: any, i: number) => row(city, i, { rcId: `${city.id}-rent-${i}`, market: "for_rent", price: 1500 + i * 100, address: `${200 + i} Fixture Ave, ${city.name}, UT 84000`, propertyType: "Apartment" });
  const everyTown = cities.flatMap((c) => [0, 1, 2].flatMap((i) => [row(c, i), rental(c, i)]));

  it("seeds 300 from the generator alone when there are no market rows", async () => {
    const t = await setup([]);
    await t.mutation(seed as any, {});
    const rows = await campaigns(t);
    expect(rows).toHaveLength(300);
    expect(rows.filter((r: any) => r.listingId)).toEqual([]);
  });

  it("swaps in 28 homes and 12 rentals, holds 300 across reseeds, and keeps every sample complete", async () => {
    const t = await setup(everyTown);
    await t.mutation(seed as any, {});
    const first = await campaigns(t);
    await t.mutation(seed as any, {});
    const rows = await campaigns(t);
    expect(rows).toHaveLength(300);
    expect(rows.map((r: any) => r.listingId).sort()).toEqual(first.map((r: any) => r.listingId).sort());

    const homes = rows.filter((r: any) => r.listingId);
    expect(homes).toHaveLength(40);
    expect(new Set(homes.map((r: any) => r.cityId)).size).toBe(40);
    expect(homes.filter((r: any) => r.listingId.startsWith("market:for_sale:"))).toHaveLength(28);
    expect(homes.filter((r: any) => r.listingId.startsWith("market:for_rent:"))).toHaveLength(12);
    expect(homes.filter((r: any) => r.kind === "pin")).toHaveLength(20);
    expect(homes.filter((r: any) => r.kind === "featured")).toHaveLength(20);

    for (const category of AD_CATEGORY_IDS) expect(rows.filter((r: any) => r.category === category).length, category).toBeGreaterThanOrEqual(20);
    for (const r of rows) {
      expect(r.isSample).toBe(true);
      expect("advertiserUserId" in r).toBe(false);
      expect(r.imageUrl).toMatch(/^\/sample-ads\/.+\.svg$/);
      expect(existsInPublic(r.imageUrl)).toBe(true);
      expect(r.title.length).toBeGreaterThanOrEqual(3);
      expect(r.title.length).toBeLessThanOrEqual(80);
      expect(r.body.length).toBeGreaterThan(0);
      expect(r.lat).toBeGreaterThan(36.9);
      expect(r.lat).toBeLessThan(42.1);
      expect(r.lng).toBeGreaterThan(-114.1);
      expect(r.lng).toBeLessThan(-108.9);
    }
    for (const cityId of new Set(rows.map((r: any) => r.cityId))) {
      const town = rows.filter((r: any) => r.cityId === cityId);
      expect(town.some((r: any) => r.kind === "featured"), `${cityId} featured`).toBe(true);
      expect(town.filter((r: any) => r.kind === "pin").length, `${cityId} pins`).toBeGreaterThanOrEqual(4);
    }
  });

  it("points each ad at a real listing, at the home, with the listing's own price and an honest label", async () => {
    const t = await setup(everyTown);
    await t.mutation(seed as any, {});
    for (const ad of (await campaigns(t)).filter((r: any) => r.listingId)) {
      const listing: any = await t.query(getListing as any, { id: ad.listingId });
      expect([ad.lat, ad.lng, ad.cityId]).toEqual([listing.lat, listing.lng, listing.cityId]);
      const price = `$${listing.askingPrice.toLocaleString("en-US")}`, street = listing.address.split(",")[0];
      expect(ad.title).toBe(listing.market === "for_rent" ? `Rent ${price}/mo at ${street}` : `Asking ${price} at ${street}`);
      expect(ad.body).toContain(listing.market === "for_rent" ? "Asking rent" : "Asking price");
      expect(ad.body).toContain("Sample ad");
      expect(validateHttpsUrl(ad.url)).toContain("https://example.com/");
    }
  });

  it("picks the town's median home and skips rows an ad cannot show", async () => {
    const provo = cities.find((c) => c.id === "provo");
    const t = await setup([
      row(provo, 0, { price: 100000 }), row(provo, 1, { price: 400000, address: null }), row(provo, 2, { price: 500000 }), row(provo, 3, { price: 900000 }),
      row(provo, 4, { rcId: "provo-rental", market: "for_rent", price: 450000 }), row(provo, 5, { rcId: "provo-land", propertyType: "Land", price: 450000 }),
    ]);
    await t.mutation(seed as any, {});
    const homes = (await campaigns(t)).filter((r: any) => r.listingId);
    expect(homes.map((r: any) => r.listingId)).toEqual(["market:for_sale:provo-2"]);
  });

  it("falls back to a rental in a town with no homes for sale", async () => {
    const t = await setup([rental(cities.find((c) => c.id === "moab"), 0)]);
    await t.mutation(seed as any, {});
    const rows = await campaigns(t);
    expect(rows).toHaveLength(300);
    expect(rows.filter((r: any) => r.listingId).map((r: any) => r.listingId)).toEqual(["market:for_rent:moab-rent-0"]);
  });

  it("leaves organic search and town ranking identical with and without the ads", async () => {
    const t = await setup(everyTown);
    const organic = async () => ({
      fit: await t.query(search as any, { weights, kind: "home", limit: 100 }),
      cheapest: await t.query(search as any, { weights, kind: "home", sort: "price_asc", limit: 100 }),
      town: await t.query(search as any, { weights, kind: "home", cityIds: ["provo"], limit: 100 }),
      rentals: await t.query(search as any, { weights, kind: "apartment", limit: 100 }),
      towns: await t.query(rank as any, { weights }),
    });
    const before = await organic();
    await t.mutation(seed as any, {});
    expect((await campaigns(t)).filter((r: any) => r.listingId).length).toBe(40);
    expect(await organic()).toEqual(before);
  });
});

const existsInPublic = (imageUrl: string) => existsSync(`public${imageUrl}`);
