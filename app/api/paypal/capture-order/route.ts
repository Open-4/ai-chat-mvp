import { NextRequest } from "next/server";
import { upgradeUserToPro } from "@/lib/kv";

/* ═══════════════════════════════════════════════════════════
   POST /api/paypal/capture-order — 去重捕获 + 升级用户
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
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

export async function POST(req: NextRequest) {
  let body: { orderId?: string; userId?: string };
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { orderId, userId } = body;
  if (!orderId || !userId) {
    return Response.json({ error: "orderId and userId required" }, { status: 400 });
  }

  try {
    const token = await getAccessToken();

    /* ── 先去重：查 PayPal 订单状态 ── */
    const statusRes = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const statusData = (await statusRes.json()) as Record<string, unknown>;

    /* 已捕获的订单直接返回成功 */
    if (statusData.status === "COMPLETED") {
      console.log(`[dedup] Order ${orderId} already completed — syncing user`);
      await upgradeUserToPro(userId);
      return Response.json({ success: true, orderId, status: "COMPLETED", duplicate: true });
    }

    if (statusData.status !== "APPROVED") {
      return Response.json({
        error: `Order not capturable: ${statusData.status as string}`,
        paypalStatus: statusData.status,
      }, { status: 400 });
    }

    /* ── 捕获支付 ── */
    const captureRes = await fetch(
      `${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      },
    );

    const data = (await captureRes.json()) as Record<string, unknown>;
    if (!captureRes.ok) {
      console.error("[paypal] Capture error:", data);
      return Response.json(
        { error: (data.message as string) ?? "Capture failed" },
        { status: captureRes.status },
      );
    }

    /* ── 升级用户 ── */
    await upgradeUserToPro(userId);
    console.log(`[paypal] Order ${orderId} captured — user ${userId} upgraded`);

    return Response.json({ success: true, orderId, status: data.status as string });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[paypal] Capture exception:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
