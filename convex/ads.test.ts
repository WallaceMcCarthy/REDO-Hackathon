import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "./schema";

const modules = {
  "./ads.ts": () => import("./ads"),
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
    expect(activePinsAfter[0]).not.toHaveProperty("advertiserUserId");
    expect(activePinsAfter[0]).not.toHaveProperty("impressions");
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

    await expect(advertiser.mutation(refs.createCampaign, {
      kind: "pin", title: "NaN duration", body: "Non-finite duration is invalid", url: "https://example.com", durationDays: Number.NaN,
    })).rejects.toThrow("Campaign duration must be between 1 and 90 days");

    await expect(advertiser.mutation(refs.createCampaign, {
      kind: "pin", title: "NaN location", body: "Non-finite coordinate is invalid", url: "https://example.com", durationDays: 7, lat: Number.NaN, lng: -111,
    })).rejects.toThrow("Location coordinates must be within Utah bounds");

    await expect(advertiser.mutation(refs.createCampaign, {
      kind: "featured", title: "Unknown city", body: "Unknown city must be rejected", url: "https://example.com", durationDays: 7, cityId: "not-a-town",
    })).rejects.toThrow("Campaign city must be a known Utah town");

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
