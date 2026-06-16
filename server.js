require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

/* ═══════════════════════════════════════
   KV 存储抽象（替换为 Redis / CF KV 即可）
   ═══════════════════════════════════════ */
const kv = new Map();

const KV = {
  get(key) {
    try { return JSON.parse(kv.get(key) ?? "null"); } catch { return null; }
  },
  set(key, value) {
    kv.set(key, JSON.stringify(value));
  },
  /** 原子更新（Lua / Redis 场景可保证并发安全） */
  async update(key, fn) {
    const val = KV.get(key) ?? {};
    const updated = await fn(val);
    KV.set(key, updated);
    return updated;
  },
};

/* ── 用户权限 ── */
async function upgradeUserToPro(userId) {
  await KV.update(`user:${userId}:perms`, (p) => ({
    ...p, userId, tier: "pro", canChat: true,
    dailyLimit: Infinity, maxConversations: Infinity,
  }));
  console.log(`[kv] User ${userId} upgraded to Pro`);
}

/* ── 年度额度 ── */
const YEAR = new Date().getFullYear().toString();
const ANNUAL_LIMIT = 50000;   // $50K 个人外汇额度
const WARN_THRESHOLD = 40000; // $40K 提醒

async function getAnnualTotal(userId) {
  return (await KV.get(`user:${userId}:yearly-total:${YEAR}`)) ?? { total: 0, orders: 0 };
}

async function addAnnualAmount(userId, amount) {
  return KV.update(`user:${userId}:yearly-total:${YEAR}`, (v) => ({
    total: (v.total ?? 0) + amount,
    orders: (v.orders ?? 0) + 1,
  }));
}

/* ═══════════════════════════════════════
   PayPal 配置
   ═══════════════════════════════════════ */
const PAYPAL_API =
  process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function getAccessToken() {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`,
  ).toString("base64");
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  return (await res.json()).access_token;
}

/* ═══════════════════════════════════════
   POST /api/paypal/create-order（幂等）
   ═══════════════════════════════════════ */
app.post("/api/paypal/create-order", async (req, res) => {
  const { userId, billing = "monthly" } = req.body;
  if (!userId) return res.status(400).json({ error: "userId required" });

  /* 额度检查 */
  const annual = await getAnnualTotal(userId);
  if (annual.total >= ANNUAL_LIMIT) {
    return res.status(403).json({
      error: "Annual payment limit reached",
      detail: `You've reached the $${ANNUAL_LIMIT.toLocaleString()} annual limit`,
      annualTotal: annual.total,
    });
  }

  const price =
    billing === "yearly"
      ? parseFloat(process.env.PRO_YEAR_PRICE ?? "95.90")
      : parseFloat(process.env.PRO_MONTH_PRICE ?? "9.90");

  /* 幂等 Key：userId + billing + 当天日期，同一天同一套餐不重复创单 */
  const today = new Date().toISOString().slice(0, 10);
  const idempotencyKey = `order-${userId}-${billing}-${today}`;

  /* 检查是否已有未完成的订单 */
  const existing = KV.get(`order-state:${userId}`);
  if (existing?.idempotencyKey === idempotencyKey && existing?.status === "pending") {
    console.log(`[idempotent] Returning existing order ${existing.orderId}`);
    return res.json({ orderId: existing.orderId, status: "CREATED", cached: true });
  }

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

    const data = await orderRes.json();
    if (!orderRes.ok) return res.status(orderRes.status).json({ error: data.message });

    /* 记录订单状态 */
    KV.set(`order:${data.id}`, {
      orderId: data.id, userId, billing, amount: price,
      status: "created", createdAt: new Date().toISOString(),
      idempotencyKey,
    });
    KV.set(`order-state:${userId}`, {
      orderId: data.id, idempotencyKey, status: "pending",
    });

    console.log(`[paypal] Order created: ${data.id} (${billing}, $${price})`);

    res.json({
      orderId: data.id,
      status: data.status,
      annualTotal: annual.total,
      annualLimit: ANNUAL_LIMIT,
      approachingLimit: annual.total >= WARN_THRESHOLD,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════
   POST /api/paypal/capture-order（去重）
   ═══════════════════════════════════════ */
app.post("/api/paypal/capture-order", async (req, res) => {
  const { orderId, userId } = req.body;
  if (!orderId || !userId)
    return res.status(400).json({ error: "orderId and userId required" });

  /* 重复支付校验 */
  const orderRecord = KV.get(`order:${orderId}`);
  if (!orderRecord) {
    return res.status(404).json({ error: "Order not found in local records" });
  }

  if (orderRecord.status === "captured") {
    console.log(`[dedup] Order ${orderId} already captured — returning success`);
    return res.json({ success: true, orderId, status: "COMPLETED", duplicate: true });
  }

  if (orderRecord.status === "refunded") {
    return res.status(400).json({ error: "Order has already been refunded" });
  }

  try {
    const token = await getAccessToken();

    /* 先查 PayPal 订单状态（防前端绕过） */
    const statusRes = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const statusData = await statusRes.json();

    if (statusData.status === "COMPLETED") {
      /* PayPal 端已完成，直接升级 */
      await upgradeUserToPro(userId);
      await addAnnualAmount(userId, orderRecord.amount);
      KV.set(`order:${orderId}`, { ...orderRecord, status: "captured", capturedAt: new Date().toISOString() });
      KV.set(`order-state:${userId}`, { ...KV.get(`order-state:${userId}`), status: "captured" });
      return res.json({ success: true, orderId, status: "COMPLETED", synced: true });
    }

    if (statusData.status !== "APPROVED") {
      return res.status(400).json({
        error: `Order not in capturable state: ${statusData.status}`,
        paypalStatus: statusData.status,
      });
    }

    /* 执行捕获 */
    const captureRes = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });

    const data = await captureRes.json();
    if (!captureRes.ok) return res.status(captureRes.status).json({ error: data.message });

    /* 升级 + 记录 */
    await upgradeUserToPro(userId);
    await addAnnualAmount(userId, orderRecord.amount);

    KV.set(`order:${orderId}`, {
      ...orderRecord, status: "captured",
      capturedAt: new Date().toISOString(),
      paypalCaptureId: data.purchase_units?.[0]?.payments?.captures?.[0]?.id,
    });
    KV.set(`order-state:${userId}`, { ...KV.get(`order-state:${userId}`), status: "captured" });

    console.log(`[paypal] Order ${orderId} captured — user ${userId} upgraded`);

    const annual = await getAnnualTotal(userId);
    res.json({
      success: true, orderId, status: data.status,
      annualTotal: annual.total,
      approachingLimit: annual.total >= WARN_THRESHOLD,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════
   POST /api/paypal/refund（退款）
   ═══════════════════════════════════════ */
app.post("/api/paypal/refund", async (req, res) => {
  const { orderId, userId, reason = "Customer requested refund" } = req.body;
  if (!orderId || !userId)
    return res.status(400).json({ error: "orderId and userId required" });

  const orderRecord = KV.get(`order:${orderId}`);
  if (!orderRecord) return res.status(404).json({ error: "Order not found" });
  if (orderRecord.status !== "captured")
    return res.status(400).json({ error: `Cannot refund order in "${orderRecord.status}" state` });

  const captureId = orderRecord.paypalCaptureId;
  if (!captureId) return res.status(400).json({ error: "No capture ID found — cannot refund" });

  try {
    const token = await getAccessToken();
    const refundRes = await fetch(`${PAYPAL_API}/v2/payments/captures/${captureId}/refund`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ note_to_payer: reason }),
    });

    const data = await refundRes.json();
    if (!refundRes.ok) return res.status(refundRes.status).json({ error: data.message });

    /* 降级用户 + 记录退款 */
    KV.set(`user:${userId}:perms`, {
      userId, tier: "free", canChat: true,
      dailyLimit: 50, maxConversations: 10,
    });
    KV.set(`order:${orderId}`, {
      ...orderRecord, status: "refunded",
      refundedAt: new Date().toISOString(),
      refundId: data.id,
    });
    KV.set(`order-state:${userId}`, { ...KV.get(`order-state:${userId}`), status: "refunded" });

    console.log(`[paypal] Refund ${data.id} for order ${orderId} — user ${userId} downgraded`);

    res.json({ success: true, refundId: data.id, status: data.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════
   GET /api/paypal/annual-limit（额度查询）
   ═══════════════════════════════════════ */
app.get("/api/paypal/annual-limit", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "userId required" });

  const annual = await getAnnualTotal(userId);
  res.json({
    year: YEAR,
    total: annual.total,
    orders: annual.orders,
    limit: ANNUAL_LIMIT,
    remaining: Math.max(0, ANNUAL_LIMIT - annual.total),
    warning: annual.total >= WARN_THRESHOLD,
    exceeded: annual.total >= ANNUAL_LIMIT,
  });
});

/* ═══════════════════════════════════════
   Webhook（带签名验证）
   ═══════════════════════════════════════ */
app.post("/api/paypal/webhook", async (req, res) => {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return res.status(500).json({ error: "Webhook not configured" });

  if (!req.headers["paypal-transmission-sig"]) {
    return res.status(401).json({ error: "Missing signature" });
  }

  try {
    const token = await getAccessToken();
    const verifyRes = await fetch(
      `${PAYPAL_API}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          auth_algo: req.headers["paypal-auth-algo"] ?? "",
          cert_url: req.headers["paypal-cert-url"] ?? "",
          transmission_id: req.headers["paypal-transmission-id"] ?? "",
          transmission_sig: req.headers["paypal-transmission-sig"] ?? "",
          transmission_time: req.headers["paypal-transmission-time"] ?? "",
          webhook_id: webhookId,
          webhook_event: req.body,
        }),
      },
    );

    const result = await verifyRes.json();
    if (result.verification_status !== "SUCCESS") {
      return res.status(401).json({ error: "Invalid signature" });
    }
  } catch (err) {
    return res.status(500).json({ error: "Verification failed" });
  }

  console.log(`[webhook] ${req.body.event_type}`);

  const event = req.body;
  const userId =
    event.resource?.custom_id ??
    event.resource?.purchase_units?.[0]?.custom_id;

  if (
    (event.event_type === "PAYMENT.CAPTURE.COMPLETED" ||
      event.event_type === "CHECKOUT.ORDER.APPROVED") &&
    userId
  ) {
    await upgradeUserToPro(userId);

    /* 记录额度（从 webhook 获取 capture amount） */
    const capture =
      event.resource?.purchase_units?.[0]?.payments?.captures?.[0];
    if (capture?.amount?.value) {
      await addAnnualAmount(userId, parseFloat(capture.amount.value));
    }
  }

  res.json({ received: true });
});

/* ═══════════════════════════════════════
   启动
   ═══════════════════════════════════════ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🌿 AI Companion — PayPal Sandbox (Hardened)`);
  console.log(`   Server:     http://localhost:${PORT}`);
  console.log(`   Pricing:    http://localhost:${PORT}/pricing.html`);
  console.log(`   APIs:       create-order | capture-order | refund | annual-limit | webhook`);
  console.log(`   Mode:       ${process.env.PAYPAL_MODE || "sandbox"}`);
  console.log(`   Annual Cap: $${ANNUAL_LIMIT.toLocaleString()} | Warn at $${WARN_THRESHOLD.toLocaleString()}\n`);
});
