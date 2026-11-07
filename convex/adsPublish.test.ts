import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";

const modules = {
  "./ads.ts": () => import("./ads"),
  "./_generated/server.js": () => import("./_generated/server.js"),
};

const refs = {
  createCheckout: makeFunctionReference<"action">("ads:createCheckout"),
  createCampaign: makeFunctionReference<"mutation">("ads:createCampaign"),
  paymentProvider: makeFunctionReference<"query">("ads:paymentProvider"),
  getActivePins: makeFunctionReference<"query">("ads:getActivePins"),
  listMyCampaigns: makeFunctionReference<"query">("ads:listMyCampaigns"),
};

const DAY = 24 * 3600 * 1000;
const ad = { kind: "pin", title: "Juniper Bike Shed", body: "Tune-ups this week", url: "https://example.com/a", durationDays: 7 } as const;

async function setup() {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx: any) => ctx.db.insert("users", { email: "owner@example.test" }));
  return { t, userId, owner: t.withIdentity({ subject: `${userId}|session` }) };
}

afterEach(() => vi.unstubAllEnvs());

describe("publishing without payment", () => {
  it("reports no payment provider unless a Stripe key is set", async () => {
    const { t } = await setup();
    expect(await t.query(refs.paymentProvider, {})).toEqual({ provider: "none" });
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
    expect(await t.query(refs.paymentProvider, {})).toEqual({ provider: "stripe" });
  });

  it("makes the ad live at once for its full duration, with no payment row", async () => {
    const { t, owner } = await setup();
    const before = Date.now();
    const res = await owner.action(refs.createCheckout, ad);
    expect(res).toMatchObject({ provider: "none", amount: 0, checkoutUrl: "/#/advertise" });

    const pins = await t.query(refs.getActivePins, {});
    expect(pins.map((p: any) => p.title)).toEqual([ad.title]);
    expect(pins[0].status).toBe("active");
    expect(pins[0].startsAt).toBeGreaterThanOrEqual(before);
    expect(pins[0].endsAt - pins[0].startsAt).toBe(7 * DAY);
    expect(await t.run((ctx: any) => ctx.db.query("payments").collect())).toEqual([]);
  });

  it("still requires sign-in and runs the campaign validation", async () => {
    const { t, owner } = await setup();
    await expect(t.action(refs.createCheckout, ad)).rejects.toThrow(/Sign in required/);
    await expect(owner.action(refs.createCheckout, { ...ad, url: "http://example.com" })).rejects.toThrow(/HTTPS/);
    await expect(owner.action(refs.createCheckout, { ...ad, imageUrl: "javascript:alert(1)" })).rejects.toThrow(/Image URL/);
    await expect(owner.action(refs.createCheckout, { ...ad, cityId: "atlantis" })).rejects.toThrow(/target town/);
    await expect(owner.action(refs.createCheckout, { ...ad, category: "casino" } as any)).rejects.toThrow();
    expect(await t.query(refs.getActivePins, {})).toEqual([]);
  });

  it("caps a user at 5 live ads, frees a slot when one ends, and leaves other users alone", async () => {
    const { t, owner } = await setup();
    for (let i = 0; i < 5; i++) await owner.action(refs.createCheckout, ad);
    await expect(owner.action(refs.createCheckout, ad)).rejects.toThrow(/already have 5 live ads/);
    expect(await owner.query(refs.listMyCampaigns, {})).toHaveLength(5);

    const otherId = await t.run((ctx: any) => ctx.db.insert("users", { email: "other@example.test" }));
    await t.withIdentity({ subject: `${otherId}|session` }).action(refs.createCheckout, ad);

    const [first] = await owner.query(refs.listMyCampaigns, {});
    await t.run((ctx: any) => ctx.db.patch(first._id, { endsAt: Date.now() - 1 }));
    await owner.action(refs.createCheckout, ad);
    await expect(owner.action(refs.createCheckout, ad)).rejects.toThrow(/already have 5 live ads/);
  });

  it("never lets the public createCampaign mutation activate anything", async () => {
    const { t, owner } = await setup();
    const { campaignId } = await owner.mutation(refs.createCampaign, ad);
    const row: any = await t.run((ctx: any) => ctx.db.get(campaignId));
    expect(row.status).toBe("pending_payment");
    expect(await t.query(refs.getActivePins, {})).toEqual([]);
  });
});

describe("with a Stripe key set", () => {
  it("creates a pending campaign and a pending payment, and shows nothing until paid", async () => {
    const { t, owner } = await setup();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ id: "cs_test_abc", url: "https://checkout.stripe.test/abc" }))));
    const res = await owner.action(refs.createCheckout, ad);
    vi.unstubAllGlobals();

    expect(res).toMatchObject({ provider: "stripe", checkoutUrl: "https://checkout.stripe.test/abc", amount: 3500 });
    expect(await t.query(refs.getActivePins, {})).toEqual([]);
    const [payment]: any[] = await t.run((ctx: any) => ctx.db.query("payments").collect());
    expect(payment).toMatchObject({ provider: "stripe", status: "pending", stripeSessionId: "cs_test_abc" });
  });
});
