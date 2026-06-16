import { NextRequest } from "next/server";

/* ═══════════════════════════════════════════════════════════
   POST /api/paypal/refund — 退款 + 降级用户
   ═══════════════════════════════════════════════════════════ */

const PAYPAL_API =
  process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error("PayPal credentials not configured");

  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

export async function POST(req: NextRequest) {
  let body: {
    orderId?: string;
    userId?: string;
    captureId?: string;
    reason?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { orderId, userId, captureId, reason = "Customer requested refund" } = body;

  if (!captureId) {
    return Response.json(
      { error: "captureId required — obtain from capture-order response" },
      { status: 400 },
    );
  }

  try {
    const token = await getAccessToken();
    const refundRes = await fetch(
      `${PAYPAL_API}/v2/payments/captures/${captureId}/refund`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ note_to_payer: reason }),
      },
    );

    const data = (await refundRes.json()) as Record<string, unknown>;
    if (!refundRes.ok) {
      return Response.json(
        { error: (data.message as string) ?? "Refund failed" },
        { status: refundRes.status },
      );
    }

    /* 降级用户 */
    const { default: kv } = await import("@/lib/kv");
    await kv.setUserPermissions(userId ?? "unknown", {
      tier: "free",
      canChat: true,
      dailyLimit: 50,
      maxConversations: 10,
    });

    console.log(
      `[paypal] Refund ${data.id as string} — user ${userId ?? "unknown"} downgraded`,
    );

    return Response.json({
      success: true,
      refundId: data.id as string,
      status: data.status as string,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
