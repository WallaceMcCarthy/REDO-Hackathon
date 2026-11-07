import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { redoClient } from "./lib/payments";

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

export default http;
