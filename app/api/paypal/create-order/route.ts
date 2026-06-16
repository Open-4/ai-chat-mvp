import { NextRequest } from "next/server";

/* ═══════════════════════════════════════════════════════════
   POST /api/paypal/create-order — 创建 PayPal 订单
   ═══════════════════════════════════════════════════════════ */

const PAYPAL_API =
  process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !secret) {
    throw new Error("PayPal credentials not configured");
  }

  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal auth failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function POST(req: NextRequest) {
  let body: {
    userId?: string;
    billing?: "monthly" | "yearly";
    locale?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, billing = "monthly", locale = "en" } = body;

  if (!userId) {
    return Response.json({ error: "userId is required" }, { status: 400 });
  }

  /* ── 从环境变量读取定价 ── */
  const price =
    billing === "yearly"
      ? parseFloat(process.env.PRO_YEAR_PRICE ?? "95.90")
      : parseFloat(process.env.PRO_MONTH_PRICE ?? "9.90");

  const description =
    billing === "yearly"
      ? "AI Companion Pro — Yearly Plan"
      : "AI Companion Pro — Monthly Plan";

  try {
    const token = await getAccessToken();

    const orderRes = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `order-${userId}-${Date.now()}`,
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "USD",
              value: price.toFixed(2),
            },
            description,
            custom_id: userId, // 回调时识别用户
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
              locale: locale === "es" ? "es-ES" : locale === "fr" ? "fr-FR" : "en-US",
              landing_page: "LOGIN",
              user_action: "PAY_NOW",
              return_url: `${req.headers.get("origin") ?? ""}/${locale}/chat`,
              cancel_url: `${req.headers.get("origin") ?? ""}/${locale}/pricing`,
            },
          },
        },
      }),
    });

    const orderData = (await orderRes.json()) as Record<string, unknown>;

    if (!orderRes.ok) {
      console.error("[paypal] Create order error:", orderData);
      return Response.json(
        {
          error:
            (orderData.message as string) ?? "Failed to create PayPal order",
        },
        { status: orderRes.status },
      );
    }

    return Response.json({
      orderId: orderData.id as string,
      status: orderData.status as string,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[paypal] Create order exception:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
