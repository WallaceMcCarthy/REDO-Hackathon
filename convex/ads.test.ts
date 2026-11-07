import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
  simulateSandboxPayment: makeFunctionReference<"mutation">("ads:simulateSandboxPayment"),
  isSandboxPaymentAllowed: makeFunctionReference<"query">("ads:isSandboxPaymentAllowed"),
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
  const originalEnv = process.env.ALLOW_SANDBOX_PAYMENTS;

  beforeEach(() => {
    delete process.env.ALLOW_SANDBOX_PAYMENTS;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ALLOW_SANDBOX_PAYMENTS = originalEnv;
    } else {
      delete process.env.ALLOW_SANDBOX_PAYMENTS;
    }
  });

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

  it("FAILS CLOSED: simulateSandboxPayment is blocked when ALLOW_SANDBOX_PAYMENTS is unset or not 'true'", async () => {
    const { advertiser } = await setup();
    delete process.env.ALLOW_SANDBOX_PAYMENTS;

    const created = await advertiser.mutation(refs.createCampaign, {
      kind: "pin",
      title: "Legit Pin",
      body: "Legit description",
      url: "https://example.com/promo",
      durationDays: 7,
      lat: 40.7608,
      lng: -111.891,
    });

    // Exploiting sandbox payment without ALLOW_SANDBOX_PAYMENTS=true fails closed
    await expect(
      advertiser.mutation(refs.simulateSandboxPayment, { campaignId: created.campaignId })
    ).rejects.toThrow("Sandbox payment simulation is disabled on this deployment");
  });

  it("Allows sandbox payment simulation only when ALLOW_SANDBOX_PAYMENTS='true'", async () => {
    const { advertiser, attacker } = await setup();
    process.env.ALLOW_SANDBOX_PAYMENTS = "true";

    const created = await advertiser.mutation(refs.createCampaign, {
      kind: "pin",
      title: "Legit Bakery",
      body: "Artisan bakery in Salt Lake",
      url: "https://example.com/bakery",
      durationDays: 7,
      lat: 40.7608,
      lng: -111.891,
    });

    // Attacker cannot simulate payment for someone else's campaign
    await expect(
      attacker.mutation(refs.simulateSandboxPayment, { campaignId: created.campaignId })
    ).rejects.toThrow("Only the campaign owner can simulate payment");

    // Owner can simulate payment when allowed
    const simRes = await advertiser.mutation(refs.simulateSandboxPayment, {
      campaignId: created.campaignId,
    });
    expect(simRes.status).toBe("active");

    const pins = await advertiser.query(refs.getActivePins, {});
    expect(pins).toHaveLength(1);
    expect(pins[0].status).toBe("active");
    // Verify isSample was forced false
    expect(pins[0].isSample).toBe(false);
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
    const { advertiser, attacker } = await setup();
    process.env.ALLOW_SANDBOX_PAYMENTS = "true";

    const created = await advertiser.mutation(refs.createCampaign, {
      kind: "featured",
      title: "Luxury Condo",
      body: "Downtown living at its finest",
      url: "https://example.com/condo",
      durationDays: 14,
    });
    await advertiser.mutation(refs.simulateSandboxPayment, { campaignId: created.campaignId });

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
