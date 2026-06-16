import { NextRequest } from "next/server";
import Stripe from "stripe";

/* ═══════════════════════════════════════════════════════════
   POST /api/stripe/checkout — 创建 Stripe Checkout Session
   ═══════════════════════════════════════════════════════════ */

export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return Response.json(
      { error: "STRIPE_SECRET_KEY is not configured" },
      { status: 500 },
    );
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: "2025-06-16.basil",
  });

  /* ── parse body ── */
  let body: {
    userId?: string;
    billing?: "monthly" | "yearly";
    locale?: string;
    successUrl?: string;
    cancelUrl?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    userId,
    billing = "monthly",
    locale = "en",
    successUrl,
    cancelUrl,
  } = body;

  if (!userId || !successUrl || !cancelUrl) {
    return Response.json(
      { error: "userId, successUrl, cancelUrl are required" },
      { status: 400 },
    );
  }

  /* ── price selection ── */
  const priceMonthly = process.env.STRIPE_PRICE_MONTHLY;
  const priceYearly = process.env.STRIPE_PRICE_YEARLY;
  const priceId = billing === "yearly" ? priceYearly : priceMonthly;

  if (!priceId) {
    return Response.json(
      {
        error: `STRIPE_PRICE_${billing === "yearly" ? "YEARLY" : "MONTHLY"} is not configured`,
      },
      { status: 500 },
    );
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        billing,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      locale: (locale === "es" ? "es" : locale === "fr" ? "fr" : "en") as
        | "en"
        | "es"
        | "fr",
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      customer_creation: "always",
    });

    return Response.json({ url: session.url });
  } catch (err) {
    const error = err as Stripe.errors.StripeError;
    console.error("[stripe] Checkout error:", error.message);
    return Response.json(
      { error: error.message ?? "Failed to create checkout session" },
      { status: error.statusCode ?? 500 },
    );
  }
}
