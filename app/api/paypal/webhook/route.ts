import { NextRequest } from "next/server";
import { upgradeUserToPro } from "@/lib/kv";

/* ═══════════════════════════════════════════════════════════
   POST /api/paypal/webhook — PayPal Webhook 异步回调
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
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function verifyWebhookSignature(
  headers: Headers,
  rawBody: string,
  webhookId: string,
): Promise<boolean> {
  const token = await getAccessToken();

  const verifyBody = {
    auth_algo: headers.get("paypal-auth-algo") ?? "",
    cert_url: headers.get("paypal-cert-url") ?? "",
    transmission_id: headers.get("paypal-transmission-id") ?? "",
    transmission_sig: headers.get("paypal-transmission-sig") ?? "",
    transmission_time: headers.get("paypal-transmission-time") ?? "",
    webhook_id: webhookId,
    webhook_event: JSON.parse(rawBody),
  };

  try {
    const res = await fetch(
      `${PAYPAL_API}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(verifyBody),
      },
    );

    const result = (await res.json()) as { verification_status: string };
    return result.verification_status === "SUCCESS";
  } catch (err) {
    console.error("[paypal] Webhook verification error:", err);
    return false;
  }
}

export async function POST(req: NextRequest) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    return Response.json(
      { error: "PAYPAL_WEBHOOK_ID not configured" },
      { status: 500 },
    );
  }

  const rawBody = await req.text();
  const verified = await verifyWebhookSignature(req.headers, rawBody, webhookId);

  if (!verified) {
    console.warn("[paypal] Webhook signature verification FAILED");
    return Response.json(
      { error: "Invalid webhook signature" },
      { status: 401 },
    );
  }

  const event = JSON.parse(rawBody) as {
    event_type: string;
    resource: Record<string, unknown>;
  };

  console.log(`[paypal] Webhook received: ${event.event_type}`);

  /* ── 支付完成 → 升级用户 ── */
  try {
    if (
      event.event_type === "PAYMENT.CAPTURE.COMPLETED" ||
      event.event_type === "CHECKOUT.ORDER.APPROVED"
    ) {
      const resource = event.resource as {
        custom_id?: string;
        id?: string;
        purchase_units?: Array<{
          payments?: { captures?: Array<{ id: string }> };
        }>;
      };

      /* 优先从 purchase_units[0].custom_id 读取 userId */
      const customId =
        resource.custom_id ??
        (event.resource as Record<string, unknown>)
          .custom_id as string | undefined;

      const userId = customId;

      if (!userId) {
        console.warn("[paypal] No userId found in webhook resource");
        return Response.json({ received: true });
      }

      await upgradeUserToPro(userId);
      console.log(`[paypal] Webhook upgraded user ${userId}`);
    }

    /* ── 订阅激活（未来扩展） ── */
    if (event.event_type === "BILLING.SUBSCRIPTION.ACTIVATED") {
      console.log("[paypal] Subscription activated:", event.resource.id);
    }
  } catch (err) {
    console.error("[paypal] Webhook processing error:", err);
    return Response.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }

  return Response.json({ received: true });
}
