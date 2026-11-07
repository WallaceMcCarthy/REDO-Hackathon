// REDO Payments Client & Sandbox Stub
// Conforms to CONTRACT.md Phase 3.
// Never exposes secret keys to git or frontend.

import crypto from "node:crypto";

export interface RedoCheckoutParams {
  campaignId: string;
  amount: number; // in cents or dollars (e.g. 5000 = $50.00)
  currency: string;
  title: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
}

export interface RedoCheckoutSession {
  sessionId: string;
  checkoutUrl: string;
  campaignId: string;
  amount: number;
  currency: string;
  expiresAt: number;
}

export interface RedoWebhookEvent {
  id: string;
  type: "payment.succeeded" | "payment.failed";
  data: {
    paymentId: string;
    campaignId: string;
    amount: number;
    currency: string;
    status: string;
  };
  signature: string;
  createdAt: number;
}

export interface IRedoPaymentClient {
  createCheckoutSession(params: RedoCheckoutParams): Promise<RedoCheckoutSession>;
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
  parseWebhookEvent(rawBody: string): RedoWebhookEvent;
}

/**
 * Sandbox implementation of the REDO Payment Client.
 * Handles checkout simulation and HMAC webhook signature verification.
 */
export class RedoSandboxClient implements IRedoPaymentClient {
  private webhookSecret: string;

  constructor(webhookSecret?: string) {
    this.webhookSecret = webhookSecret || process.env.REDO_WEBHOOK_SECRET || "redo_sandbox_secret_2026";
  }

  async createCheckoutSession(params: RedoCheckoutParams): Promise<RedoCheckoutSession> {
    const sessionId = `redo_sess_${crypto.randomBytes(12).toString("hex")}`;
    const checkoutUrl = `https://sandbox.getredo.com/checkout/${sessionId}?campaignId=${params.campaignId}&amt=${params.amount}`;

    return {
      sessionId,
      checkoutUrl,
      campaignId: params.campaignId,
      amount: params.amount,
      currency: params.currency || "USD",
      expiresAt: Date.now() + 3600 * 1000,
    };
  }

  computeSignature(rawBody: string): string {
    return crypto
      .createHmac("sha256", this.webhookSecret)
      .update(rawBody)
      .digest("hex");
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!signature || !rawBody) return false;
    try {
      const expected = this.computeSignature(rawBody);
      // Constant-time buffer comparison to prevent timing attacks
      const expectedBuf = Buffer.from(expected, "hex");
      const sigBuf = Buffer.from(signature, "hex");
      if (expectedBuf.length !== sigBuf.length) return false;
      return crypto.timingSafeEqual(expectedBuf, sigBuf);
    } catch {
      return false;
    }
  }

  parseWebhookEvent(rawBody: string): RedoWebhookEvent {
    const parsed = JSON.parse(rawBody);
    if (!parsed.id || !parsed.type || !parsed.data?.campaignId) {
      throw new Error("Invalid REDO webhook event structure");
    }
    return parsed as RedoWebhookEvent;
  }
}

/** Default singleton instance of the REDO payment client */
export const redoClient = new RedoSandboxClient();
