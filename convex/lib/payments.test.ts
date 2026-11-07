import { describe, expect, it } from "vitest";
import { RedoSandboxClient } from "./payments";

describe("RedoSandboxClient", () => {
  const secret = "test_webhook_secret_key";
  const client = new RedoSandboxClient(secret);

  it("creates a checkout session with proper parameters", async () => {
    const session = await client.createCheckoutSession({
      campaignId: "camp_123",
      amount: 4900,
      currency: "USD",
      title: "Featured Pin",
      description: "Sponsored map pin",
      successUrl: "https://cmascope.com/ads/success",
      cancelUrl: "https://cmascope.com/ads/cancel",
    });

    expect(session.sessionId).toContain("redo_sess_");
    expect(session.checkoutUrl).toContain(session.sessionId);
    expect(session.amount).toBe(4900);
    expect(session.campaignId).toBe("camp_123");
  });

  it("verifies authentic webhook signatures", () => {
    const rawPayload = JSON.stringify({
      id: "evt_12345",
      type: "payment.succeeded",
      data: {
        paymentId: "pay_987",
        campaignId: "camp_123",
        amount: 4900,
        currency: "USD",
        status: "succeeded",
      },
    });

    const sig = client.computeSignature(rawPayload);
    expect(client.verifyWebhookSignature(rawPayload, sig)).toBe(true);
  });

  it("rejects tampered or forged webhook payloads", () => {
    const rawPayload = JSON.stringify({ id: "evt_12345", type: "payment.succeeded" });
    const sig = client.computeSignature(rawPayload);

    const tampered = JSON.stringify({ id: "evt_12345", type: "payment.failed" });
    expect(client.verifyWebhookSignature(tampered, sig)).toBe(false);
    expect(client.verifyWebhookSignature(rawPayload, "invalid_hex_signature")).toBe(false);
  });

  it("parses valid webhook events and throws on invalid structure", () => {
    const valid = JSON.stringify({
      id: "evt_001",
      type: "payment.succeeded",
      data: { campaignId: "camp_1" },
    });
    expect(client.parseWebhookEvent(valid).id).toBe("evt_001");

    const invalid = JSON.stringify({ foo: "bar" });
    expect(() => client.parseWebhookEvent(invalid)).toThrow();
  });
});
