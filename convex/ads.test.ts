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
  simulateSandboxPayment: makeFunctionReference<"mutation">("ads:simulateSandboxPayment"),
};

async function setup() {
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", { email: "advertiser@example.test" });
  });
  const advertiser = t.withIdentity({ subject: `${userId}|test-session` });
  return { t, userId, advertiser };
}

describe("authenticated ads and sandbox payments", () => {
  it("rejects unauthenticated writes (Phase 3 ground rule)", async () => {
    const { t, advertiser } = await setup();

    // Create campaign as advertiser
    const res = await advertiser.mutation(refs.createCampaign, {
      kind: "pin",
      title: "Test Business",
      body: "Best local bakery",
      url: "https://example.test",
      durationDays: 7,
    });
    expect(res.checkoutUrl).toContain("#ads-sandbox-checkout");
    expect(res.checkoutUrl).not.toContain("sandbox.getredo.com");

    // Anonymous writes must reject with sign in required
    await expect(
      t.mutation(refs.createCampaign, {
        kind: "pin",
        title: "Anon Business",
        body: "Test",
        url: "https://example.test",
        durationDays: 7,
      })
    ).rejects.toThrow("Sign in");

    await expect(
      t.mutation(refs.recordImpression, { campaignId: res.campaignId })
    ).rejects.toThrow("Sign in");

    await expect(
      t.mutation(refs.recordClick, { campaignId: res.campaignId })
    ).rejects.toThrow("Sign in");

    await expect(
      t.mutation(refs.simulateSandboxPayment, { campaignId: res.campaignId })
    ).rejects.toThrow("Sign in");
  });

  it("handles campaign lifecycle: create -> pending -> simulateSandboxPayment -> active pin", async () => {
    const { advertiser } = await setup();

    // Initial pins should be empty
    const initialPins = await advertiser.query(refs.getActivePins, {});
    expect(initialPins).toEqual([]);

    // Create campaign
    const created = await advertiser.mutation(refs.createCampaign, {
      kind: "pin",
      title: "Park City Gear",
      body: "Ski and bike rentals",
      url: "https://example.test/gear",
      durationDays: 14,
    });

    // Should be pending, not yet active
    const pinsWhilePending = await advertiser.query(refs.getActivePins, {});
    expect(pinsWhilePending).toEqual([]);

    // Simulate payment in sandbox
    const simRes = await advertiser.mutation(refs.simulateSandboxPayment, {
      campaignId: created.campaignId,
    });
    expect(simRes.status).toBe("active");

    // Now active pin should be visible in query
    const activePins = await advertiser.query(refs.getActivePins, {});
    expect(activePins).toHaveLength(1);
    expect(activePins[0].title).toBe("Park City Gear");
    expect(activePins[0].status).toBe("active");

    // Authenticated impressions and clicks
    await advertiser.mutation(refs.recordImpression, { campaignId: created.campaignId });
    await advertiser.mutation(refs.recordClick, { campaignId: created.campaignId });

    const myCampaigns = await advertiser.query(refs.listMyCampaigns, {});
    expect(myCampaigns[0].impressions).toBe(1);
    expect(myCampaigns[0].clicks).toBe(1);
  });
});
