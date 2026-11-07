import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { redoClient, verifyStripeSignature } from "./lib/payments";

declare const process: { env?: Record<string, string | undefined> } | undefined;

const http = httpRouter();

auth.addHttpRoutes(http);

// REDO webhook endpoint with HMAC signature verification and idempotency
http.route({
  path: "/redo-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const signature =
      request.headers.get("x-redo-signature") ||
      request.headers.get("redo-signature") ||
      "";
    const rawBody = await request.text();

    // Async Web Crypto HMAC signature verification; fails closed if secret is unset
    const isValid = await redoClient.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      console.warn("[REDO Webhook] Unauthorized attempt: signature verification failed or secret unset");
      return new Response("Invalid signature or unconfigured secret", { status: 401 });
    }

    try {
      const event = redoClient.parseWebhookEvent(rawBody);
      if (event.type === "payment.succeeded") {
        await ctx.runMutation((internal as any).ads.fulfillRedoPayment, {
          campaignId: event.data.campaignId,
          redoPaymentId: event.data.paymentId,
          amount: event.data.amount,
          currency: event.data.currency,
          rawEventId: event.id,
        });
      }
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

// Stripe webhook: verified signature, fail closed when STRIPE_WEBHOOK_SECRET is unset.
http.route({
  path: "/webhooks/stripe",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process?.env?.STRIPE_WEBHOOK_SECRET;
    if (!secret || !secret.trim()) {
      return new Response("Webhook not configured", { status: 401 });
    }
    const rawBody = await request.text();
    const ok = await verifyStripeSignature(rawBody, request.headers.get("stripe-signature"), secret);
    if (!ok) {
      return new Response("Invalid signature", { status: 401 });
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return new Response("Bad JSON", { status: 400 });
    }

    const session = event?.data?.object;
    if (
      event?.type === "checkout.session.completed" &&
      session?.payment_status === "paid" &&
      typeof event.id === "string"
    ) {
      const campaignId = session.metadata?.campaignId ?? session.client_reference_id;
      if (typeof campaignId === "string" && typeof session.id === "string") {
        await ctx.runMutation(internal.ads.fulfillStripePayment, {
          eventId: event.id,
          sessionId: session.id,
          campaignId,
          amountTotal: Number(session.amount_total ?? 0),
          currency: String(session.currency ?? ""),
        });
      }
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
