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
const ad = { kind: "pin", title: "Juniper Bike Shed", body: "Tune-ups this week", url: "https://example.com/a", durationDays: 7, lat: 40.76, lng: -111.89, imageUrl: "https://example.com/i.png" } as const;

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

  it("fills in everything the form no longer asks for", async () => {
    const { t, owner } = await setup();
    await t.run((ctx: any) => Promise.all([
      ctx.db.insert("cities", { id: "kanab", name: "Kanab", county: "Kane", lat: 37.05, lng: -112.53, population: 1, blurb: "" }),
      ctx.db.insert("cities", { id: "logan", name: "Logan", county: "Cache", lat: 41.74, lng: -111.83, population: 1, blurb: "" }),
    ]));
    const { kind, title, durationDays, ...form } = ad;
    await owner.action(refs.createCheckout, { ...form, lat: 37.1, lng: -112.5, body: `Slot canyon tours ${"daily ".repeat(20)}` });

    const [row] = await t.query(refs.getActivePins, {});
    expect(row).toMatchObject({ kind: "pin", category: "other", cityId: "kanab" });
    expect(row.endsAt - row.startsAt).toBe(7 * DAY);
    expect(row.title).toHaveLength(80);
    expect(row.title.endsWith("…")).toBe(true);
    expect(row.body.startsWith(row.title.slice(0, -1))).toBe(true);
  });

  it("requires a location inside Utah and an image", async () => {
    const { t, owner } = await setup();
    const { lat, lng, ...noLocation } = ad;
    await expect(owner.action(refs.createCheckout, noLocation)).rejects.toThrow(/location on the map/);
    await expect(owner.action(refs.createCheckout, { ...ad, lat: 40.71, lng: -74.01 })).rejects.toThrow(/Utah bounds/);
    await expect(owner.action(refs.createCheckout, { ...ad, lat: NaN })).rejects.toThrow(/Utah bounds/);
    await expect(owner.action(refs.createCheckout, { ...ad, imageUrl: "" })).rejects.toThrow(/image URL/);
    expect(await t.query(refs.getActivePins, {})).toEqual([]);
  });

  it("still requires sign-in and runs the campaign validation", async () => {
    const { t, owner } = await setup();
    await expect(t.action(refs.createCheckout, ad)).rejects.toThrow(/Sign in required/);
    await expect(owner.action(refs.createCheckout, { ...ad, url: "http://example.com" })).rejects.toThrow(/https:/);
    await expect(owner.action(refs.createCheckout, { ...ad, imageUrl: "javascript:alert(1)" })).rejects.toThrow(/image url/i);
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
  const noStripeCall = () => vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("a free ad must not reach Stripe"); }));
  const free = { ...ad, free: true };

  it("makes a free ad live at once for one day, with no checkout and no payment row", async () => {
    const { t, owner } = await setup();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
    noStripeCall();
    const res = await owner.action(refs.createCheckout, free);
    vi.unstubAllGlobals();

    expect(res).toMatchObject({ provider: "none", amount: 0 });
    const [pin] = await t.query(refs.getActivePins, {});
    expect(pin).toMatchObject({ status: "active", expectedAmount: 0 });
    expect(pin.endsAt - pin.startsAt).toBe(DAY);
    expect(await t.run((ctx: any) => ctx.db.query("payments").collect())).toEqual([]);
  });

  it("gives a free ad nothing the client asks for beyond its content", async () => {
    const { t, owner } = await setup();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
    await owner.action(refs.createCheckout, { ...free, kind: "featured", durationDays: 90 });
    const [row] = await owner.query(refs.listMyCampaigns, {});
    expect(row).toMatchObject({ kind: "pin", expectedAmount: 0 });
    expect(row.endsAt - row.startsAt).toBe(DAY);
    await expect(owner.action(refs.createCheckout, { ...free, url: "http://example.com" })).rejects.toThrow(/https:/);
    await expect(owner.action(refs.createCheckout, { ...free, lat: 40.71, lng: -74.01 })).rejects.toThrow(/Utah bounds/);
    await expect(t.action(refs.createCheckout, free)).rejects.toThrow(/Sign in required/);
  });

  it("does not let the pending-payment mutation take the free flag", async () => {
    const { owner } = await setup();
    await expect(owner.mutation(refs.createCampaign, { ...ad, free: true } as any)).rejects.toThrow();
  });

  it("ends a free ad after a day", async () => {
    const { t, owner } = await setup();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
    await owner.action(refs.createCheckout, free);
    expect(await t.query(refs.getActivePins, {})).toHaveLength(1);
    const later = Date.now() + DAY + 1000;
    vi.spyOn(Date, "now").mockReturnValue(later);
    expect(await t.query(refs.getActivePins, {})).toEqual([]);
    vi.restoreAllMocks();
  });

  it("allows 3 free ads per account per 24 hours, even after they end, then frees up", async () => {
    const { t, owner } = await setup();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
    for (let i = 0; i < 3; i++) await owner.action(refs.createCheckout, free);
    const mine = await owner.query(refs.listMyCampaigns, {});
    await t.run(async (ctx: any) => { for (const c of mine) await ctx.db.patch(c._id, { endsAt: Date.now() - 1 }); });
    await expect(owner.action(refs.createCheckout, free)).rejects.toThrow(/3 free ads every 24 hours/);
    expect(await owner.query(refs.listMyCampaigns, {})).toHaveLength(3);

    const otherId = await t.run((ctx: any) => ctx.db.insert("users", { email: "other@example.test" }));
    await t.withIdentity({ subject: `${otherId}|session` }).action(refs.createCheckout, free);

    await t.run(async (ctx: any) => { for (const c of mine) await ctx.db.patch(c._id, { startsAt: Date.now() - DAY - 1 }); });
    await owner.action(refs.createCheckout, free);
  });

  it("holds free ads to the 5 live ad cap", async () => {
    const { t, owner, userId } = await setup();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
    await t.run((ctx: any) => Promise.all([0, 1, 2, 3, 4].map((i) => ctx.db.insert("campaigns", {
      advertiserUserId: userId, kind: "pin", title: `Paid ${i}`, body: "A paid ad", url: "https://example.com", startsAt: Date.now(),
      endsAt: Date.now() + DAY, status: "active", impressions: 0, clicks: 0, isSample: false, expectedAmount: 3500,
    }))));
    await expect(owner.action(refs.createCheckout, free)).rejects.toThrow(/already have 5 live ads/);
  });

  it("prices a form submission on the server and names it on the checkout", async () => {
    const { t, owner } = await setup();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ id: "cs_test_def", url: "https://checkout.stripe.test/def" }))));
    const { kind, title, durationDays, ...form } = ad;
    const res = await owner.action(refs.createCheckout, form);
    const body = String((fetch as any).mock.calls[0][1].body);
    vi.unstubAllGlobals();

    expect(res).toMatchObject({ provider: "stripe", amount: 3500 });
    expect(decodeURIComponent(body)).toContain("pin");
    expect(decodeURIComponent(body)).not.toContain("undefined");
    expect(await t.query(refs.getActivePins, {})).toEqual([]);
  });

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
