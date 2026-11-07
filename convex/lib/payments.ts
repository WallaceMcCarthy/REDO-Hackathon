// REDO Payments Client & Sandbox Stub
// Conforms to CONTRACT.md Phase 3.
// Standard Web Crypto API only (no Node imports) to ensure full Convex runtime compatibility.
// Never exposes secret keys to git or frontend.

declare const process: { env?: Record<string, string | undefined> } | undefined;

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
  verifyWebhookSignature(rawBody: string, signature: string): Promise<boolean>;
  parseWebhookEvent(rawBody: string): RedoWebhookEvent;
}

/**
 * Constant-time comparison between two hex strings to mitigate timing attacks.
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  const normA = a.toLowerCase();
  const normB = b.toLowerCase();
  if (normA.length !== normB.length) return false;
  let diff = 0;
  for (let i = 0; i < normA.length; i++) {
    diff |= normA.charCodeAt(i) ^ normB.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Compute SHA-256 HMAC using Web Crypto API.
 */
export async function computeHmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Minimal provider-agnostic checkout client (REDO sandbox or Stripe). */
export interface CheckoutClient {
  readonly provider: "redo" | "stripe";
  createCheckoutSession(params: RedoCheckoutParams): Promise<RedoCheckoutSession>;
}

/**
 * Sandbox implementation of the REDO Payment Client.
 * Handles checkout simulation and Web Crypto HMAC webhook signature verification.
 * Fails closed if REDO_WEBHOOK_SECRET is not configured.
 */
export class RedoSandboxClient implements IRedoPaymentClient, CheckoutClient {
  readonly provider = "redo" as const;
  private webhookSecret?: string;

  constructor(webhookSecret?: string) {
    this.webhookSecret =
      webhookSecret ||
      (typeof process !== "undefined" && process?.env ? process.env.REDO_WEBHOOK_SECRET : undefined);
  }

  isConfigured(): boolean {
    return Boolean(this.webhookSecret && this.webhookSecret.trim().length > 0);
  }

  async createCheckoutSession(params: RedoCheckoutParams): Promise<RedoCheckoutSession> {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const randomHex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const sessionId = `redo_sandbox_${randomHex}`;

    // Conforms strictly to review instructions:
    // Do NOT invent external provider endpoints (e.g. sandbox.getredo.com) before REDO docs arrive.
    // Point to our in-app sandbox checkout page: /#ads-sandbox-checkout
    const query = new URLSearchParams({
      sessionId,
      campaignId: params.campaignId,
      amount: String(params.amount),
      currency: params.currency || "USD",
      title: params.title || "",
    }).toString();
    const checkoutUrl = `/#ads-sandbox-checkout?${query}`;

    return {
      sessionId,
      checkoutUrl,
      campaignId: params.campaignId,
      amount: params.amount,
      currency: params.currency || "USD",
      expiresAt: Date.now() + 3600 * 1000,
    };
  }

  async computeSignature(rawBody: string): Promise<string> {
    if (!this.webhookSecret) {
      throw new Error("REDO_WEBHOOK_SECRET is not configured (fail closed)");
    }
    return computeHmacSha256Hex(this.webhookSecret, rawBody);
  }

  async verifyWebhookSignature(rawBody: string, signature: string): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn("[REDO] Webhook rejected: REDO_WEBHOOK_SECRET is not configured (failing closed).");
      return false;
    }
    if (!signature || !rawBody) {
      return false;
    }
    try {
      const expected = await this.computeSignature(rawBody);
      return timingSafeEqualHex(expected, signature.trim());
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

// ---------------------------------------------------------------------------
// Stripe (test mode) via plain fetch to the REST API. No SDK, no Node imports.
// ---------------------------------------------------------------------------

export const STRIPE_CHECKOUT_URL = "https://api.stripe.com/v1/checkout/sessions";
export const STRIPE_TOLERANCE_SECONDS = 300;

/** Build the form-encoded body for POST /v1/checkout/sessions. Amount is in cents. */
export function buildStripeSessionParams(params: RedoCheckoutParams): URLSearchParams {
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("line_items[0][price_data][currency]", (params.currency || "usd").toLowerCase());
  body.set("line_items[0][price_data][product_data][name]", params.title);
  body.set("line_items[0][price_data][unit_amount]", String(Math.round(params.amount)));
  body.set("line_items[0][quantity]", "1");
  body.set("success_url", params.successUrl);
  body.set("cancel_url", params.cancelUrl);
  body.set("client_reference_id", params.campaignId);
  body.set("metadata[campaignId]", params.campaignId);
  return body;
}

export class StripePaymentClient implements CheckoutClient {
  readonly provider = "stripe" as const;
  private secretKey: string;
  private fetchImpl: typeof fetch;

  constructor(secretKey: string, fetchImpl?: typeof fetch) {
    this.secretKey = secretKey;
    this.fetchImpl = fetchImpl ?? ((...args) => fetch(...args));
  }

  async createCheckoutSession(params: RedoCheckoutParams): Promise<RedoCheckoutSession> {
    const res = await this.fetchImpl(STRIPE_CHECKOUT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: buildStripeSessionParams(params).toString(),
    });
    const json = (await res.json().catch(() => ({}))) as {
      id?: string;
      url?: string;
      expires_at?: number;
      error?: { message?: string };
    };
    if (!res.ok || !json.id || !json.url) {
      throw new Error(`Stripe checkout session failed: ${json.error?.message ?? res.status}`);
    }
    return {
      sessionId: json.id,
      checkoutUrl: json.url,
      campaignId: params.campaignId,
      amount: params.amount,
      currency: (params.currency || "usd").toUpperCase(),
      expiresAt: (json.expires_at ?? 0) * 1000,
    };
  }
}

/**
 * Verify a Stripe-Signature header (`t=...,v1=...`): HMAC-SHA256 of `${t}.${rawBody}`,
 * constant-time compared to any v1, within a timestamp tolerance. Fails closed.
 */
export async function verifyStripeSignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string | undefined,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  toleranceSeconds: number = STRIPE_TOLERANCE_SECONDS,
): Promise<boolean> {
  if (!secret || !secret.trim() || !header || !rawBody) return false;
  let timestamp = "";
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (k === "t") timestamp = val;
    else if (k === "v1") v1.push(val);
  }
  const t = Number(timestamp);
  if (!timestamp || !Number.isFinite(t) || v1.length === 0) return false;
  if (Math.abs(nowSeconds - t) > toleranceSeconds) return false;
  const expected = await computeHmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  let ok = false;
  for (const sig of v1) {
    if (timingSafeEqualHex(expected, sig)) ok = true;
  }
  return ok;
}

/** Stripe when STRIPE_SECRET_KEY is set, otherwise the labeled REDO sandbox. */
export function selectPaymentClient(env?: Record<string, string | undefined>): CheckoutClient {
  const e = env ?? (typeof process !== "undefined" ? process?.env : undefined) ?? {};
  const key = e.STRIPE_SECRET_KEY?.trim();
  return key ? new StripePaymentClient(key) : redoClient;
}
