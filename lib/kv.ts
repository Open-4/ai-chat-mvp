/* ═══════════════════════════════════════════════════════════
   lib/kv.ts — Cloudflare KV 操作封装
   按用户维度隔离数据 | 对话 CRUD | 用量追踪 | 权限校验
   ═══════════════════════════════════════════════════════════ */

/* ── Cloudflare KV 接口（自包含，无需外部 types 包） ── */
interface CFKVNamespace {
  get(key: string): Promise<string | null>;
  get(key: string, type: "json"): Promise<unknown>;
  get(key: string, type: "text" | "json" | "arrayBuffer" | "stream"): Promise<unknown>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: { name: string; expiration?: number }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

/* ── Data types ── */

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  emotion?: { type: string; label: string };
}

export interface ConversationData {
  id: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ConversationListItem {
  id: string;
  title: string;
  lastMessage: string;
  updatedAt: string;
}

export interface UserUsage {
  userId: string;
  messageCount: number;
  conversationCount: number;
  dailyMessageCount: number;
  lastResetDate: string;
}

export interface UserPermissions {
  userId: string;
  canChat: boolean;
  tier: "free" | "pro";
  /** 免费版每日限额，pro 为 Infinity */
  dailyLimit: number;
  /** 免费版最大会话数，pro 为 Infinity */
  maxConversations: number;
}

/* ═══════════════════════════════════════════
   In-memory fallback（本地开发 / 无 KV 绑定时）
   ═══════════════════════════════════════════ */

const memoryStore = new Map<string, string>();

const memoryKV: CFKVNamespace = {
  async get(key: string) {
    return memoryStore.get(key) ?? null;
  },
  async put(key: string, value: string) {
    memoryStore.set(key, value);
  },
  async delete(key: string) {
    memoryStore.delete(key);
  },
  async list(options?: { prefix?: string; limit?: number }) {
    const prefix = options?.prefix ?? "";
    const limit = options?.limit ?? 1000;
    const keys: { name: string }[] = [];
    for (const k of memoryStore.keys()) {
      if (k.startsWith(prefix)) keys.push({ name: k });
      if (keys.length >= limit) break;
    }
    return { keys, list_complete: keys.length < limit };
  },
};

/* ═══════════════════════════════════════════
   KV 绑定获取（单例缓存）
   ═══════════════════════════════════════════ */

let _kv: CFKVNamespace | null = null;

function getKV(): CFKVNamespace {
  if (_kv) return _kv;

  /* Cloudflare Pages 生产环境：通过 process.env 访问 KV binding */
  const env = process.env as Record<string, unknown>;
  // Cloudflare binds KV namespaces as env vars matching the binding name
  const binding = (env.CHAT_KV ?? env.__NEXT_ON_PAGES__KV) as
    | CFKVNamespace
    | undefined;

  if (binding && typeof binding.get === "function") {
    _kv = binding;
  } else {
    console.warn("[kv] ⚠ CHAT_KV binding not found — using in-memory store");
    _kv = memoryKV;
  }

  return _kv;
}

/* ═══════════════════════════════════════════
   Key 生成工具（用户维度隔离）
   ═══════════════════════════════════════════ */

const K = {
  conversation: (userId: string, convId: string) =>
    `user:${userId}:conv:${convId}`,
  conversationList: (userId: string) => `user:${userId}:convlist`,
  usage: (userId: string) => `user:${userId}:usage`,
  permissions: (userId: string) => `user:${userId}:perms`,
};

/* ═══════════════════════════════════════════
   通用安全 JSON 解析
   ═══════════════════════════════════════════ */

async function readJSON<T>(key: string): Promise<T | null> {
  try {
    const kv = getKV();
    const raw = await kv.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`[kv] readJSON failed for "${key}":`, err);
    return null;
  }
}

async function writeJSON<T>(key: string, data: T): Promise<void> {
  try {
    const kv = getKV();
    await kv.put(key, JSON.stringify(data));
  } catch (err) {
    console.error(`[kv] writeJSON failed for "${key}":`, err);
    throw new Error(`Failed to write data for key: ${key}`);
  }
}

/* ═══════════════════════════════════════════
   1. 对话 CRUD
   ═══════════════════════════════════════════ */

/** 保存 / 更新单条对话 */
export async function saveConversation(
  userId: string,
  conversation: ConversationData,
): Promise<void> {
  if (!userId || !conversation.id) {
    throw new Error("[kv] userId and conversation.id are required");
  }

  /* 确保 userId 一致性 */
  const data: ConversationData = {
    ...conversation,
    userId,
    updatedAt: new Date().toISOString(),
    createdAt: conversation.createdAt || new Date().toISOString(),
  };

  /* 写入对话本体 */
  await writeJSON(K.conversation(userId, data.id), data);

  /* 更新对话列表索引 */
  const list =
    (await readJSON<ConversationListItem[]>(K.conversationList(userId))) ?? [];
  const idx = list.findIndex((c) => c.id === data.id);
  const item: ConversationListItem = {
    id: data.id,
    title: data.title,
    lastMessage:
      data.messages.length > 0
        ? data.messages[data.messages.length - 1].content.slice(0, 80)
        : "",
    updatedAt: data.updatedAt,
  };

  if (idx >= 0) {
    list[idx] = item;
  } else {
    list.unshift(item); // newest first
  }

  await writeJSON(K.conversationList(userId), list);
}

/** 获取用户对话列表（摘要） */
export async function getUserConversations(
  userId: string,
): Promise<ConversationListItem[]> {
  if (!userId) throw new Error("[kv] userId is required");

  try {
    const list =
      await readJSON<ConversationListItem[]>(K.conversationList(userId));
    return list ?? [];
  } catch (err) {
    console.error(`[kv] getUserConversations failed for "${userId}":`, err);
    return [];
  }
}

/** 获取单条对话详情 */
export async function getConversation(
  userId: string,
  conversationId: string,
): Promise<ConversationData | null> {
  if (!userId || !conversationId) {
    throw new Error("[kv] userId and conversationId are required");
  }

  try {
    const data = await readJSON<ConversationData>(
      K.conversation(userId, conversationId),
    );
    /* 跨用户隔离校验 */
    if (data && data.userId !== userId) {
      console.warn(
        `[kv] Cross-user access blocked: ${userId} → conv owned by ${data.userId}`,
      );
      return null;
    }
    return data;
  } catch (err) {
    console.error(
      `[kv] getConversation failed for "${userId}/${conversationId}":`,
      err,
    );
    return null;
  }
}

/** 删除单条对话 */
export async function deleteConversation(
  userId: string,
  conversationId: string,
): Promise<void> {
  if (!userId || !conversationId) {
    throw new Error("[kv] userId and conversationId are required");
  }

  const kv = getKV();

  try {
    /* 删除对话本体 */
    await kv.delete(K.conversation(userId, conversationId));

    /* 从列表中移除 */
    const list =
      (await readJSON<ConversationListItem[]>(K.conversationList(userId))) ??
      [];
    const filtered = list.filter((c) => c.id !== conversationId);
    await writeJSON(K.conversationList(userId), filtered);
  } catch (err) {
    console.error(
      `[kv] deleteConversation failed for "${userId}/${conversationId}":`,
      err,
    );
    throw new Error("Failed to delete conversation");
  }
}

/* ═══════════════════════════════════════════
   2. 用户用量追踪
   ═══════════════════════════════════════════ */

function todayStr(): string {
  return new Date().toISOString().slice(0, 10); // "2026-06-16"
}

function defaultUsage(userId: string): UserUsage {
  return {
    userId,
    messageCount: 0,
    conversationCount: 0,
    dailyMessageCount: 0,
    lastResetDate: todayStr(),
  };
}

/** 获取用户用量 */
export async function getUserUsage(userId: string): Promise<UserUsage> {
  if (!userId) throw new Error("[kv] userId is required");

  try {
    const usage = await readJSON<UserUsage>(K.usage(userId));
    if (!usage) return defaultUsage(userId);

    /* 跨天重置日用量 */
    if (usage.lastResetDate !== todayStr()) {
      return { ...usage, dailyMessageCount: 0, lastResetDate: todayStr() };
    }

    return usage;
  } catch (err) {
    console.error(`[kv] getUserUsage failed for "${userId}":`, err);
    return defaultUsage(userId);
  }
}

/** 增加用户消息计数 */
export async function incrementUserUsage(userId: string): Promise<UserUsage> {
  if (!userId) throw new Error("[kv] userId is required");

  try {
    const usage = await getUserUsage(userId);
    const updated: UserUsage = {
      ...usage,
      messageCount: usage.messageCount + 1,
      dailyMessageCount: usage.dailyMessageCount + 1,
      lastResetDate: todayStr(),
    };
    await writeJSON(K.usage(userId), updated);
    return updated;
  } catch (err) {
    console.error(`[kv] incrementUserUsage failed for "${userId}":`, err);
    throw new Error("Failed to update usage");
  }
}

/** 增加用户会话计数 */
export async function incrementConversationCount(
  userId: string,
): Promise<UserUsage> {
  if (!userId) throw new Error("[kv] userId is required");

  try {
    const usage = await getUserUsage(userId);
    const updated: UserUsage = {
      ...usage,
      conversationCount: usage.conversationCount + 1,
      lastResetDate: todayStr(),
    };
    await writeJSON(K.usage(userId), updated);
    return updated;
  } catch (err) {
    console.error(
      `[kv] incrementConversationCount failed for "${userId}":`,
      err,
    );
    throw new Error("Failed to update conversation count");
  }
}

/* ═══════════════════════════════════════════
   3. 用户权限校验
   ═══════════════════════════════════════════ */

const FREE_LIMITS = {
  dailyLimit: 50,
  maxConversations: 10,
};

function defaultPermissions(userId: string): UserPermissions {
  return {
    userId,
    canChat: true,
    tier: "free",
    ...FREE_LIMITS,
  };
}

/** 获取用户权限 */
export async function getUserPermissions(
  userId: string,
): Promise<UserPermissions> {
  if (!userId) throw new Error("[kv] userId is required");

  try {
    const perms = await readJSON<UserPermissions>(K.permissions(userId));
    return perms ?? defaultPermissions(userId);
  } catch (err) {
    console.error(`[kv] getUserPermissions failed for "${userId}":`, err);
    return defaultPermissions(userId);
  }
}

/** 设置用户权限 */
export async function setUserPermissions(
  userId: string,
  permissions: Partial<Omit<UserPermissions, "userId">>,
): Promise<void> {
  if (!userId) throw new Error("[kv] userId is required");

  try {
    const current = await getUserPermissions(userId);
    const updated: UserPermissions = { ...current, ...permissions, userId };
    await writeJSON(K.permissions(userId), updated);
  } catch (err) {
    console.error(`[kv] setUserPermissions failed for "${userId}":`, err);
    throw new Error("Failed to update permissions");
  }
}

/** 校验用户是否可以继续聊天 */
export async function canUserChat(
  userId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const [perms, usage] = await Promise.all([
      getUserPermissions(userId),
      getUserUsage(userId),
    ]);

    if (!perms.canChat) {
      return { allowed: false, reason: "Account is restricted" };
    }

    if (usage.dailyMessageCount >= perms.dailyLimit) {
      return {
        allowed: false,
        reason: `Daily message limit (${perms.dailyLimit}) reached`,
      };
    }

    return { allowed: true };
  } catch (err) {
    console.error(`[kv] canUserChat failed for "${userId}":`, err);
    /* 容错：KV 异常时默认放行，避免阻塞用户 */
    return { allowed: true };
  }
}

/* ═══════════════════════════════════════════
   Utility: 初始化/重置用户数据
   ═══════════════════════════════════════════ */

/** 初始化新用户的用量和权限（首次访问时调用） */
export async function initializeUser(userId: string): Promise<void> {
  if (!userId) throw new Error("[kv] userId is required");

  try {
    const usage = await readJSON<UserUsage>(K.usage(userId));
    if (!usage) {
      await writeJSON(K.usage(userId), defaultUsage(userId));
    }

    const perms = await readJSON<UserPermissions>(K.permissions(userId));
    if (!perms) {
      await writeJSON(K.permissions(userId), defaultPermissions(userId));
    }

    const list = await readJSON<ConversationListItem[]>(
      K.conversationList(userId),
    );
    if (!list) {
      await writeJSON(K.conversationList(userId), []);
    }
  } catch (err) {
    console.error(`[kv] initializeUser failed for "${userId}":`, err);
    throw new Error("Failed to initialize user");
  }
}

/* ═══════════════════════════════════════════
   4. 情绪日记
   ═══════════════════════════════════════════ */

export interface JournalEntry {
  id: string;
  userId: string;
  content: string;
  emotion: string;
  emotionLabel: string;
  date: string; // "2026-06-16"
  timestamp: string;
}

/** 保存单条日记 */
export async function saveJournalEntry(
  userId: string,
  entry: JournalEntry,
): Promise<void> {
  if (!userId || !entry.id) {
    throw new Error("[kv] userId and entry.id are required");
  }

  try {
    const key = `user:${userId}:journal:${entry.date}`;
    const entries = await readJSON<JournalEntry[]>(key);
    const list = entries ?? [];
    list.push(entry);
    await writeJSON(key, list);
  } catch (err) {
    console.error(`[kv] saveJournalEntry failed for "${userId}":`, err);
    throw new Error("Failed to save journal entry");
  }
}

/** 获取某天的日记列表 */
export async function getJournalEntries(
  userId: string,
  date: string,
): Promise<JournalEntry[]> {
  if (!userId || !date) throw new Error("[kv] userId and date are required");

  try {
    const key = `user:${userId}:journal:${date}`;
    const entries = await readJSON<JournalEntry[]>(key);
    return entries ?? [];
  } catch (err) {
    console.error(`[kv] getJournalEntries failed for "${userId}/${date}":`, err);
    return [];
  }
}

/** 获取所有日记日期列表（摘要） */
export async function getJournalDates(
  userId: string,
): Promise<{ date: string; count: number; emotion: string }[]> {
  if (!userId) throw new Error("[kv] userId is required");

  try {
    const kv = getKV();
    const result = await kv.list({ prefix: `user:${userId}:journal:` });
    const dates: { date: string; count: number; emotion: string }[] = [];

    for (const { name } of result.keys) {
      const date = name.split(":journal:")[1];
      if (!date) continue;
      const entries = await readJSON<JournalEntry[]>(name);
      const last = entries?.[entries.length - 1];
      dates.push({
        date,
        count: entries?.length ?? 0,
        emotion: last?.emotion ?? "calm",
      });
    }

    return dates.sort((a, b) => b.date.localeCompare(a.date));
  } catch (err) {
    console.error(`[kv] getJournalDates failed for "${userId}":`, err);
    return [];
  }
}

/** 获取某月所有日记（YYYY-MM 格式） */
export async function getJournalEntriesByMonth(
  userId: string,
  yearMonth: string, // "2026-06"
): Promise<JournalEntry[]> {
  if (!userId || !yearMonth) throw new Error("[kv] userId and yearMonth are required");

  try {
    const all: JournalEntry[] = [];
    /* 遍历当月每一天，收集日记 */
    const [y, m] = yearMonth.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();

    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${yearMonth}-${String(d).padStart(2, "0")}`;
      const entries = await getJournalEntries(userId, date);
      all.push(...entries);
    }

    return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  } catch (err) {
    console.error(`[kv] getJournalEntriesByMonth failed:`, err);
    return [];
  }
}

/* ═══════════════════════════════════════════
   5. 订阅升级（支付回调用）
   ═══════════════════════════════════════════ */

/** 将用户升级为 Pro，重置用量限制 */
export async function upgradeUserToPro(userId: string): Promise<void> {
  if (!userId) throw new Error("[kv] userId is required");

  try {
    await setUserPermissions(userId, {
      tier: "pro",
      canChat: true,
      dailyLimit: Infinity,
      maxConversations: Infinity,
    });
    console.log(`[kv] User ${userId} upgraded to Pro`);
  } catch (err) {
    console.error(`[kv] upgradeUserToPro failed for "${userId}":`, err);
    throw new Error("Failed to upgrade user");
  }
}

/** 查询用户订阅等级 */
export async function getUserTier(userId: string): Promise<string> {
  if (!userId) throw new Error("[kv] userId is required");
  try {
    const perms = await getUserPermissions(userId);
    return perms.tier;
  } catch {
    return "free";
  }
}
