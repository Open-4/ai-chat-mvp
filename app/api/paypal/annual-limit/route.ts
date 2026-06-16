import { NextRequest } from "next/server";
import { getUserTier } from "@/lib/kv";

/* ═══════════════════════════════════════════════════════════
   GET /api/paypal/annual-limit — 查询年度额度与订阅状态
   ═══════════════════════════════════════════════════════════ */

const YEAR = new Date().getFullYear().toString();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return Response.json({ error: "userId required" }, { status: 400 });
  }

  try {
    const tier = await getUserTier(userId);
    /* 简化版：年度额度从 KV 权限推断，实际生产可独立存储 */
    const perms =
      tier === "pro"
        ? { dailyLimit: "unlimited", maxConversations: "unlimited" }
        : { dailyLimit: 50, maxConversations: 10 };

    return Response.json({
      userId,
      year: YEAR,
      tier,
      ...perms,
      limit: 50000,
      remaining:
        tier === "pro" ? 50000 : 50000, // 简化：未跟踪实际累计
      warning: false,
      exceeded: false,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
