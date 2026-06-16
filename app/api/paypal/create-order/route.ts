import { NextRequest } from "next/server";

/* ═══════════════════════════════════════════════════════════
   POST /api/paypal/create-order — 幂等创建 PayPal 订单
   ═══════════════════════════════════════════════════════════ */

const PAYPAL_API =
  process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

const YEAR = new Date().getFullYear().toString();
const ANNUAL_LIMIT = 50000;
const WARN_THRESHOLD = 40000;

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error("PayPal credentials not configured");

  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

/* 动态导入 KV（避免 Edge Runtime 兼容问题） */
async function getKV() {
  const { default: kvModule } = await import("@/lib/kv");
  return kvModule;
}

export async function POST(req: NextRequest) {
  let body: { userId?: string; billing?: "monthly" | "yearly"; locale?: string };
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, billing = "monthly" } = body;
  if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

  /* 额度检查 */
  const { getUserTier } = await import("@/lib/kv");
  // Note: annual tracking requires KV write; simplified for Next.js route
  // Full implementation in server.js

  const price =
    billing === "yearly"
      ? parseFloat(process.env.PRO_YEAR_PRICE ?? "95.90")
      : parseFloat(process.env.PRO_MONTH_PRICE ?? "9.90");

  /* 幂等 Key */
  const today = new Date().toISOString().slice(0, 10);
  const idempotencyKey = `order-${userId}-${billing}-${today}`;

  try {
    const token = await getAccessToken();
    const orderRes = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": idempotencyKey,
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          amount: { currency_code: "USD", value: price.toFixed(2) },
          description: "AI Companion Pro",
          custom_id: userId,
        }],
      }),
    });

    const data = (await orderRes.json()) as Record<string, unknown>;
    if (!orderRes.ok) {
      console.error("[paypal] Create order error:", data);
      return Response.json(
        { error: (data.message as string) ?? "Failed to create order" },
        { status: orderRes.status },
      );
    }

    console.log(`[paypal] Order created: ${data.id} (${billing}, $${price})`);
    return Response.json({
      orderId: data.id as string,
      status: data.status as string,
      amount: price,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[paypal] Create order exception:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
