import { NextRequest } from "next/server";
import Stripe from "stripe";
import { upgradeUserToPro } from "@/lib/kv";

/* ═══════════════════════════════════════════════════════════
   POST /api/stripe/webhook — Stripe Webhook 回调
   ═══════════════════════════════════════════════════════════ */

export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    return Response.json(
      { error: "Stripe keys not configured" },
      { status: 500 },
    );
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: "2025-06-16.basil",
  });

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return Response.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const error = err as Error;
    console.error("[stripe] Webhook signature verification failed:", error.message);
    return Response.json(
      { error: `Webhook signature verification failed` },
      { status: 401 },
    );
  }

  /* ── Handle checkout.session.completed ── */
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;

    if (!userId) {
      console.warn("[stripe] No userId in session metadata");
      return Response.json({ received: true });
    }

    try {
      await upgradeUserToPro(userId);
      console.log(`[stripe] User ${userId} upgraded to Pro (session: ${session.id})`);
    } catch (err) {
      console.error(`[stripe] Failed to upgrade user ${userId}:`, err);
      return Response.json(
        { error: "Failed to upgrade user" },
        { status: 500 },
      );
    }
  }

  /* ── Handle subscription.deleted (downgrade) ── */
  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata?.userId;

    if (userId) {
      console.log(
        `[stripe] Subscription deleted for user ${userId} — manual downgrade needed`,
      );
      /* Optional: auto-downgrade after subscription expires */
    }
  }

  return Response.json({ received: true });
}
