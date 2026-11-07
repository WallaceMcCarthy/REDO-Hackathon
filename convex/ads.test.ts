import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AD_CATEGORY_IDS } from "./lib/adCategories";
import schema from "./schema";

const modules = {
  "./ads.ts": () => import("./ads"),
  "./search.ts": () => import("./search"),
  "./sampleData.ts": () => import("./sampleData"),
  "./_generated/server.js": () => import("./_generated/server.js"),
};

const refs = {
  createCampaign: makeFunctionReference<"mutation">("ads:createCampaign"),
  listMyCampaigns: makeFunctionReference<"query">("ads:listMyCampaigns"),
  getActivePins: makeFunctionReference<"query">("ads:getActivePins"),
  getActiveFeatured: makeFunctionReference<"query">("ads:getActiveFeatured"),
  recordImpression: makeFunctionReference<"mutation">("ads:recordImpression"),
  recordClick: makeFunctionReference<"mutation">("ads:recordClick"),
  fulfillRedoPayment: makeFunctionReference<"mutation">("ads:fulfillRedoPayment"),
  rank: makeFunctionReference<"query">("search:rank"),
  seedSample: makeFunctionReference<"mutation">("sampleData:seedSampleContent"),
};

async function setup() {
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", { email: "advertiser@example.test" });
  });
  const attackerId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", { email: "attacker@example.test" });
  });

  const advertiser = t.withIdentity({ subject: `${userId}|test-session` });
  const attacker = t.withIdentity({ subject: `${attackerId}|attacker-session` });
  return { t, userId, advertiser, attackerId, attacker };
}

describe("ads security & exploit resistance", () => {
  it("REJECTS Stored XSS exploit payloads (javascript:alert(document.cookie))", async () => {
    const { advertiser } = await setup();

    // Exact exploit payload from security audit
    await expect(
      advertiser.mutation(refs.createCampaign, {
        kind: "pin",
        title: "XSS Pin",
        body: "Payload test",
        url: "javascript:alert(document.cookie)",
        durationDays: 7,
      })
    ).rejects.toThrow("Destination URL must use HTTPS protocol (https://)");

    // Insecure HTTP rejected
    await expect(
      advertiser.mutation(refs.createCampaign, {
        kind: "featured",
        title: "HTTP Ad",
        body: "Insecure promo",
        url: "http://insecure-site.com",
        durationDays: 7,
      })
    ).rejects.toThrow("Destination URL must use HTTPS protocol (https://)");

    // Data URI rejected
    await expect(
      advertiser.mutation(refs.createCampaign, {
        kind: "job",
        title: "Data Ad",
        body: "Data URI test",
        url: "data:text/html,<script>alert(1)</script>",
        durationDays: 7,
      })
    ).rejects.toThrow("Destination URL must use HTTPS protocol (https://)");
  });

  it("Enforces pending_payment until verified REDO webhook confirmation", async () => {
    const { t, advertiser } = await setup();

    const created = await advertiser.mutation(refs.createCampaign, {
      kind: "pin",
      title: "Legit Bakery",
      body: "Artisan bakery in Salt Lake City",
      url: "https://example.com/bakery",
      durationDays: 7,
      lat: 40.7608,
      lng: -111.891,
    });

    // Campaign starts in pending_payment
    const myCampaigns = await advertiser.query(refs.listMyCampaigns, {});
    expect(myCampaigns[0].status).toBe("pending_payment");
    expect(myCampaigns[0].isSample).toBe(false);

    // It does not appear in public active pins
    const activePinsBefore = await advertiser.query(refs.getActivePins, {});
    expect(activePinsBefore).toHaveLength(0);

    // Only internal webhook fulfillment can activate the campaign
    await t.mutation(refs.fulfillRedoPayment, {
      campaignId: created.campaignId,
      redoPaymentId: "pay_verified_12345",
      amount: created.amount,
      currency: "USD",
      rawEventId: "evt_redo_123",
    });

    // Now active pin is visible
    const activePinsAfter = await advertiser.query(refs.getActivePins, {});
    expect(activePinsAfter).toHaveLength(1);
    expect(activePinsAfter[0].status).toBe("active");
  });

  it("Validates input bounds and Utah coordinates", async () => {
    const { advertiser } = await setup();

    // Out-of-bounds coordinates (e.g. New York: 40.7128° N, 74.0060° W)
    await expect(
      advertiser.mutation(refs.createCampaign, {
        kind: "pin",
        title: "NYC Pin",
        body: "Outside Utah boundary",
        url: "https://example.com",
        durationDays: 7,
        lat: 40.7128,
        lng: -74.006,
      })
    ).rejects.toThrow("Location coordinates must be within Utah bounds");

    // Duration out of bounds
    await expect(
      advertiser.mutation(refs.createCampaign, {
        kind: "pin",
        title: "Bad Duration",
        body: "Outside duration",
        url: "https://example.com",
        durationDays: 0,
      })
    ).rejects.toThrow("Campaign duration must be between 1 and 90 days");

    // Oversized title
    await expect(
      advertiser.mutation(refs.createCampaign, {
        kind: "pin",
        title: "A".repeat(81),
        body: "Oversized title test",
        url: "https://example.com",
        durationDays: 7,
      })
    ).rejects.toThrow("Campaign title must be between 3 and 80 characters");
  });

  it("Prevents campaign owners from inflating their own impressions and clicks", async () => {
    const { t, advertiser, attacker } = await setup();

    const created = await advertiser.mutation(refs.createCampaign, {
      kind: "featured",
      title: "Luxury Condo",
      body: "Downtown living at its finest",
      url: "https://example.com/condo",
      durationDays: 14,
    });

    // Activate via webhook
    await t.mutation(refs.fulfillRedoPayment, {
      campaignId: created.campaignId,
      redoPaymentId: "pay_condo_99",
      amount: created.amount,
      currency: "USD",
      rawEventId: "evt_condo_99",
    });

    // Owner viewing or clicking own ad does NOT increment metrics
    await advertiser.mutation(refs.recordImpression, { campaignId: created.campaignId });
    await advertiser.mutation(refs.recordClick, { campaignId: created.campaignId });

    let myCampaigns = await advertiser.query(refs.listMyCampaigns, {});
    expect(myCampaigns[0].impressions).toBe(0);
    expect(myCampaigns[0].clicks).toBe(0);

    // Another user viewing and clicking DOES increment metrics
    await attacker.mutation(refs.recordImpression, { campaignId: created.campaignId });
    await attacker.mutation(refs.recordClick, { campaignId: created.campaignId });

    myCampaigns = await advertiser.query(refs.listMyCampaigns, {});
    expect(myCampaigns[0].impressions).toBe(1);
    expect(myCampaigns[0].clicks).toBe(1);
  });
});

describe("ad categories and placement", () => {
  const cities: any[] = JSON.parse(readFileSync("data/cities.json", "utf8"));
  const draft = { kind: "pin", title: "Corner Shop", body: "A short pitch", url: "https://example.com/a", durationDays: 7 };
  const seedCities = (t: any) => t.run(async (ctx: any) => { for (const c of cities) await ctx.db.insert("cities", c); });
  const campaign = { kind: "featured", title: "Paid slot", body: "A short pitch", url: "https://example.com/a", startsAt: 0, impressions: 0, clicks: 0, isSample: false };

  it("stores a valid category and files a missing one under other", async () => {
    const { t, advertiser } = await setup();
    await advertiser.mutation(refs.createCampaign, { ...draft, category: "food" });
    await advertiser.mutation(refs.createCampaign, draft);
    const rows: any[] = await t.run((ctx: any) => ctx.db.query("campaigns").collect());
    expect(rows.map((r) => r.category).sort()).toEqual(["food", "other"]);
  });

  it("rejects a category outside the list", async () => {
    const { advertiser } = await setup();
    await expect(advertiser.mutation(refs.createCampaign, { ...draft, category: "casino" })).rejects.toThrow(/casino/);
  });

  it("stores an https image and rejects any other image URL", async () => {
    const { t, advertiser } = await setup();
    await advertiser.mutation(refs.createCampaign, { ...draft, imageUrl: "https://example.com/a.png" });
    const rows: any[] = await t.run((ctx: any) => ctx.db.query("campaigns").collect());
    expect(rows[0].imageUrl).toBe("https://example.com/a.png");
    for (const imageUrl of ["http://example.com/a.png", "javascript:alert(1)", "data:image/svg+xml,<svg/>", "/sample-ads/food.svg"]) {
      await expect(advertiser.mutation(refs.createCampaign, { ...draft, imageUrl })).rejects.toThrow(/Image URL/);
    }
  });

  it("rejects a target town that does not exist and accepts a real one", async () => {
    const { t, advertiser } = await setup();
    await seedCities(t);
    await expect(advertiser.mutation(refs.createCampaign, { ...draft, cityId: "atlantis" })).rejects.toThrow("Choose a target town from the list");
    await expect(advertiser.mutation(refs.createCampaign, { ...draft, cityId: "provo" })).resolves.toBeDefined();
  });

  it("never changes rankTowns output, even for active campaigns on the last-ranked town", async () => {
    const { t } = await setup();
    await seedCities(t);
    await t.run(async (ctx: any) => {
      await ctx.db.insert("metrics", {
        id: "trails", label: "Trails", category: "outdoors", unit: "trails", higherIsBetter: true, description: "", source: "", sourceUrl: "", year: 2024,
        values: Object.fromEntries(cities.map((c, i) => [c.id, i])),
      });
    });
    const args = { weights: { trails: 1 } };
    const before: any[] = await t.query(refs.rank, args);
    const last = before[before.length - 1].cityId;
    expect(last).toBe(cities[0].id);

    await t.run(async (ctx: any) => {
      for (const kind of ["featured", "pin", "job"]) {
        await ctx.db.insert("campaigns", { ...campaign, kind, cityId: last, category: "food", status: "active", endsAt: Date.now() + 1e9 });
      }
    });
    await t.mutation(refs.seedSample, {});

    expect(await t.query(refs.rank, args)).toEqual(before);
  });

  it("never shows a pending, expired, or out-of-date campaign", async () => {
    const { t } = await setup();
    const future = Date.now() + 1e9;
    await t.run(async (ctx: any) => {
      for (const kind of ["featured", "pin"]) {
        await ctx.db.insert("campaigns", { ...campaign, kind, cityId: "provo", status: "pending_payment", endsAt: future });
        await ctx.db.insert("campaigns", { ...campaign, kind, cityId: "provo", status: "expired", endsAt: future });
        await ctx.db.insert("campaigns", { ...campaign, kind, cityId: "provo", status: "active", endsAt: Date.now() - 1 });
      }
    });
    expect(await t.query(refs.getActivePins, { cityId: "provo" })).toEqual([]);
    expect(await t.query(refs.getActiveFeatured, { cityId: "provo" })).toEqual([]);
  });

  it("seeds varied labelled samples idempotently and leaves paying campaigns alone", async () => {
    const { t } = await setup();
    await seedCities(t);
    await t.run((ctx: any) => ctx.db.insert("campaigns", { ...campaign, status: "active", endsAt: Date.now() + 1e9 }));
    await t.mutation(refs.seedSample, {});
    await t.mutation(refs.seedSample, {});

    const rows: any[] = await t.run((ctx: any) => ctx.db.query("campaigns").collect());
    const samples = rows.filter((r) => r.isSample);
    expect(rows.length - samples.length).toBe(1);
    expect(samples.length).toBeGreaterThanOrEqual(25);
    expect(new Set(samples.map((s) => s.cityId)).size).toBeGreaterThanOrEqual(10);
    expect(new Set(samples.map((s) => s.category))).toEqual(new Set(AD_CATEGORY_IDS));
    for (const s of samples) {
      const city = cities.find((c) => c.id === s.cityId);
      expect([s.lat, s.lng]).toEqual([city.lat, city.lng]);
      expect(s.url).toMatch(/^https:\/\//);
      expect(existsSync(`public${s.imageUrl}`)).toBe(true);
      expect(s.advertiserUserId).toBeUndefined();
      expect(s.status).toBe("active");
    }
  });
});
