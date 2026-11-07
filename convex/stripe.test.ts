import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it, vi } from "vitest";
import schema from "./schema";
import {
  buildStripeSessionParams,
  computeHmacSha256Hex,
  RedoSandboxClient,
  selectPaymentClient,
  StripePaymentClient,
  verifyStripeSignature,
} from "./lib/payments";
import { priceCents } from "./lib/pricing";

const secret = "whsec_test_known_secret";
const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
const ts = 1_700_000_000;

async function header(t = ts, b = body, s = secret) {
  return `t=${t},v1=${await computeHmacSha256Hex(s, `${t}.${b}`)}`;
}

describe("verifyStripeSignature", () => {
  it("accepts a valid signature", async () => {
    expect(await verifyStripeSignature(body, await header(), secret, ts + 10)).toBe(true);
  });
  it("accepts when any v1 matches", async () => {
    const h = `${await header()},v1=${"0".repeat(64)}`;
    expect(await verifyStripeSignature(body, h, secret, ts)).toBe(true);
  });
  it("rejects tampered body and wrong secret", async () => {
    expect(await verifyStripeSignature(body + " ", await header(), secret, ts)).toBe(false);
    expect(await verifyStripeSignature(body, await header(ts, body, "other"), secret, ts)).toBe(false);
  });
  it("rejects outside the 300s tolerance, accepts at the edge", async () => {
    expect(await verifyStripeSignature(body, await header(), secret, ts + 301)).toBe(false);
    expect(await verifyStripeSignature(body, await header(), secret, ts - 301)).toBe(false);
    expect(await verifyStripeSignature(body, await header(), secret, ts + 300)).toBe(true);
  });
  it("fails closed with no secret, no header or malformed header", async () => {
    expect(await verifyStripeSignature(body, await header(), undefined, ts)).toBe(false);
    expect(await verifyStripeSignature(body, await header(), "", ts)).toBe(false);
    expect(await verifyStripeSignature(body, null, secret, ts)).toBe(false);
    expect(await verifyStripeSignature(body, "garbage", secret, ts)).toBe(false);
    expect(await verifyStripeSignature(body, `t=${ts}`, secret, ts)).toBe(false);
  });
});

describe("Stripe session params and client", () => {
  it("builds params with the server-side amount", () => {
    const amount = priceCents("featured", 7);
    expect(amount).toBe(7000);
    const p = buildStripeSessionParams({
      campaignId: "camp1",
      amount,
      currency: "USD",
      title: "My Ad, featured",
      description: "",
      successUrl: "https://x.test/#ads?paid={CHECKOUT_SESSION_ID}",
      cancelUrl: "https://x.test/#ads?canceled=1",
    });
    expect(p.get("mode")).toBe("payment");
    expect(p.get("line_items[0][price_data][currency]")).toBe("usd");
    expect(p.get("line_items[0][price_data][unit_amount]")).toBe("7000");
    expect(p.get("line_items[0][price_data][product_data][name]")).toBe("My Ad, featured");
    expect(p.get("line_items[0][quantity]")).toBe("1");
    expect(p.get("success_url")).toBe("https://x.test/#ads?paid={CHECKOUT_SESSION_ID}");
    expect(p.get("cancel_url")).toBe("https://x.test/#ads?canceled=1");
    expect(p.get("client_reference_id")).toBe("camp1");
    expect(p.get("metadata[campaignId]")).toBe("camp1");
  });

  it("posts to Stripe with bearer auth and returns session id and url", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" }), { status: 200 }),
    );
    const client = new StripePaymentClient("sk_test_fake", fetchMock as unknown as typeof fetch);
    const s = await client.createCheckoutSession({
      campaignId: "c", amount: 500, currency: "USD", title: "t", description: "", successUrl: "s", cancelUrl: "c",
    });
    expect(s.sessionId).toBe("cs_test_1");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk_test_fake");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/x-www-form-urlencoded");
  });

  it("selects the client by env", () => {
    expect(selectPaymentClient({ STRIPE_SECRET_KEY: "sk_test_x" }).provider).toBe("stripe");
    expect(selectPaymentClient({}).provider).toBe("redo");
    expect(selectPaymentClient({}) instanceof RedoSandboxClient).toBe(true);
  });
});

describe("fulfillStripePayment", () => {
  const modules = {
    "./ads.ts": () => import("./ads"),
    "./_generated/server.js": () => import("./_generated/server.js"),
  };
  const fulfill = makeFunctionReference<"mutation">("ads:fulfillStripePayment");
  const pending = makeFunctionReference<"mutation">("ads:createPendingCampaign");
  const record = makeFunctionReference<"mutation">("ads:recordCheckoutSession");

  async function seed() {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => ctx.db.insert("users", { email: "a@example.test" }));
    const c = await t.mutation(pending, {
      userId, kind: "job", title: "Hiring now", body: "Join our team", url: "https://example.com", durationDays: 7,
    });
    await t.mutation(record, {
      campaignId: c.campaignId, provider: "stripe", sessionId: "cs_1", amount: c.amount, currency: "USD",
    });
    return { t, c };
  }

  it("prices server-side, activates once, and is idempotent on event id", async () => {
    const { t, c } = await seed();
    expect(c.amount).toBe(4900);
    const args = { eventId: "evt_a", sessionId: "cs_1", campaignId: c.campaignId, amountTotal: 4900, currency: "usd" };
    expect((await t.mutation(fulfill, args)).status).toBe("activated");
    expect((await t.mutation(fulfill, args)).status).toBe("already_processed");
    // different event, same session: still no double processing
    expect((await t.mutation(fulfill, { ...args, eventId: "evt_b" })).status).toBe("already_processed");

    const { campaign, payments } = await t.run(async (ctx: any) => ({
      campaign: await ctx.db.get(c.campaignId),
      payments: await ctx.db.query("payments").collect(),
    }));
    expect(campaign.status).toBe("active");
    expect(campaign.endsAt - campaign.startsAt).toBe(7 * 24 * 3600 * 1000);
    expect(payments).toHaveLength(1);
    expect(payments[0].status).toBe("paid");
    expect(payments[0].stripeSessionId).toBe("cs_1");
  });

  it("does not activate on underpayment", async () => {
    const { t, c } = await seed();
    const r = await t.mutation(fulfill, {
      eventId: "evt_c", sessionId: "cs_1", campaignId: c.campaignId, amountTotal: 100, currency: "usd",
    });
    expect(r.status).toBe("amount_mismatch");
    const campaign = await t.run(async (ctx: any) => ctx.db.get(c.campaignId));
    expect(campaign.status).toBe("pending_payment");
  });
});

describe("confirmCheckout (webhook-free)", () => {
  const modules = {
    "./ads.ts": () => import("./ads"),
    "./_generated/server.js": () => import("./_generated/server.js"),
  };
  const confirm = makeFunctionReference<"action">("ads:confirmCheckout");
  const pending = makeFunctionReference<"mutation">("ads:createPendingCampaign");
  const record = makeFunctionReference<"mutation">("ads:recordCheckoutSession");
  const SID = "cs_test_abc123";

  async function seed() {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx: any) => ctx.db.insert("users", { email: "a@example.test" }));
    const otherId = await t.run(async (ctx: any) => ctx.db.insert("users", { email: "b@example.test" }));
    const c = await t.mutation(pending, {
      userId, kind: "job", title: "Hiring now", body: "Join our team", url: "https://example.com", durationDays: 7,
    });
    await t.mutation(record, {
      campaignId: c.campaignId, provider: "stripe", sessionId: SID, amount: c.amount, currency: "USD",
    });
    return {
      t, c,
      owner: t.withIdentity({ subject: `${userId}|s1` }),
      other: t.withIdentity({ subject: `${otherId}|s2` }),
    };
  }

  function mockStripe(c: { campaignId: string; amount: number }, paid: boolean) {
    const f = vi.fn(async () =>
      new Response(JSON.stringify({
        id: SID, payment_status: paid ? "paid" : "unpaid", amount_total: c.amount, currency: "usd",
        metadata: { campaignId: c.campaignId },
      }), { status: 200 }),
    );
    vi.stubGlobal("fetch", f);
    return f;
  }

  const status = async (t: any, id: string) => (await t.run(async (ctx: any) => ctx.db.get(id))).status;

  it("activates on a paid session, and a second confirm is a no-op", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
    const { owner, t, c } = await seed();
    const f = mockStripe(c, true);
    expect(await owner.action(confirm, { sessionId: SID })).toEqual({ status: "active" });
    expect(await status(t, c.campaignId)).toBe("active");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.stripe.com/v1/checkout/sessions/${SID}`);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk_test_fake");
    const before = await t.run(async (ctx: any) => ctx.db.get(c.campaignId));
    expect(await owner.action(confirm, { sessionId: SID })).toEqual({ status: "active" });
    const after = await t.run(async (ctx: any) => ctx.db.get(c.campaignId));
    expect(after.endsAt).toBe(before.endsAt);
    expect(await t.run(async (ctx: any) => ctx.db.query("payments").collect())).toHaveLength(1);
    vi.unstubAllGlobals(); vi.unstubAllEnvs();
  });

  it("does not activate an unpaid session", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
    const { owner, t, c } = await seed();
    mockStripe(c, false);
    expect(await owner.action(confirm, { sessionId: SID })).toEqual({ status: "unpaid" });
    expect(await status(t, c.campaignId)).toBe("pending_payment");
    vi.unstubAllGlobals(); vi.unstubAllEnvs();
  });

  it("returns not_found for another user's session without calling Stripe", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
    const { other, t, c } = await seed();
    const f = mockStripe(c, true);
    expect(await other.action(confirm, { sessionId: SID })).toEqual({ status: "not_found" });
    expect(f).not.toHaveBeenCalled();
    expect(await status(t, c.campaignId)).toBe("pending_payment");
    vi.unstubAllGlobals(); vi.unstubAllEnvs();
  });

  it("rejects an invalid session id and unauthenticated callers", async () => {
    const { owner, t } = await seed();
    await expect(owner.action(confirm, { sessionId: "../evil?x=1" })).rejects.toThrow(/Invalid session id/);
    await expect(owner.action(confirm, { sessionId: "cs_prod_abc" })).rejects.toThrow(/Invalid session id/);
    await expect(t.action(confirm, { sessionId: SID })).rejects.toThrow(/Sign in required/);
  });
});
