import { describe, expect, it } from "vitest";
import { RedoSandboxClient, timingSafeEqualHex } from "./payments";

describe("RedoSandboxClient", () => {
  const secret = "test_webhook_secret_key_12345";
  const client = new RedoSandboxClient(secret);

  it("creates a sandbox checkout session pointing to in-app #ads-sandbox-checkout", async () => {
    const session = await client.createCheckoutSession({
      campaignId: "camp_123",
      amount: 4900,
      currency: "USD",
      title: "Featured Pin",
      description: "Sponsored map pin",
      successUrl: "https://cmascope.com/ads/success",
      cancelUrl: "https://cmascope.com/ads/cancel",
    });

    expect(session.sessionId).toContain("redo_sandbox_");
    // Explicitly verifies no invented external sandbox URLs
    expect(session.checkoutUrl).not.toContain("sandbox.getredo.com");
    expect(session.checkoutUrl).toContain("#ads-sandbox-checkout");
    expect(session.checkoutUrl).toContain("campaignId=camp_123");
    expect(session.checkoutUrl).toContain("amount=4900");
    expect(session.amount).toBe(4900);
    expect(session.campaignId).toBe("camp_123");
  });

  it("fails closed when webhook secret is missing or unset", async () => {
    const unconfiguredClient = new RedoSandboxClient("");
    expect(unconfiguredClient.isConfigured()).toBe(false);

    const payload = JSON.stringify({ id: "evt_1", type: "payment.succeeded" });
    const verified = await unconfiguredClient.verifyWebhookSignature(payload, "some_sig");
    expect(verified).toBe(false);

    await expect(unconfiguredClient.computeSignature(payload)).rejects.toThrow(
      "REDO_WEBHOOK_SECRET is not configured"
    );
  });

  it("verifies authentic webhook signatures using Web Crypto SHA-256 HMAC", async () => {
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

    const sig = await client.computeSignature(rawPayload);
    expect(sig).toHaveLength(64); // SHA-256 hex length
    const isValid = await client.verifyWebhookSignature(rawPayload, sig);
    expect(isValid).toBe(true);
  });

  it("rejects tampered or forged webhook payloads", async () => {
    const rawPayload = JSON.stringify({ id: "evt_12345", type: "payment.succeeded" });
    const sig = await client.computeSignature(rawPayload);

    const tampered = JSON.stringify({ id: "evt_12345", type: "payment.failed" });
    expect(await client.verifyWebhookSignature(tampered, sig)).toBe(false);
    expect(await client.verifyWebhookSignature(rawPayload, "invalid_hex_signature")).toBe(false);
    expect(await client.verifyWebhookSignature("", sig)).toBe(false);
    expect(await client.verifyWebhookSignature(rawPayload, "")).toBe(false);
  });

  it("parses valid webhook events and throws on invalid structure", () => {
    const valid = JSON.stringify({
      id: "evt_001",
      type: "payment.succeeded",
      data: { campaignId: "camp_1" },
    });
    expect(client.parseWebhookEvent(valid).id).toBe("evt_001");

    const invalid = JSON.stringify({ foo: "bar" });
    expect(() => client.parseWebhookEvent(invalid)).toThrow("Invalid REDO webhook event structure");
  });

  it("compares signatures in constant time", () => {
    expect(timingSafeEqualHex("abcdef123456", "abcdef123456")).toBe(true);
    expect(timingSafeEqualHex("ABCDEF123456", "abcdef123456")).toBe(true);
    expect(timingSafeEqualHex("abcdef123456", "abcdef123457")).toBe(false);
    expect(timingSafeEqualHex("abcdef123456", "abcdef12345")).toBe(false);
  });
});
