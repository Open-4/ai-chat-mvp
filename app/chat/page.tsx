"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useLocale } from "@/lib/use-locale";
import ChatSidebar, { type ConversationItem } from "./_components/ChatSidebar";
import ChatBubble, { type Emotion } from "./_components/ChatBubble";
import ChatInput from "./_components/ChatInput";
import {
  initializeUser,
  getUserConversations,
  getConversation,
  saveConversation,
  type ConversationData,
} from "@/lib/kv";

/* ── helpers ── */
function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

/* ═══════════════════════════════════════════
   多语言词典
   ═══════════════════════════════════════════ */
const t: Record<string, Record<string, string>> = {
  en: {
    title: "AI Companion",
    subtitle: "Your gentle healing partner",
    newChat: "New Chat",
    inputPlaceholder: "Share how you feel…",
    menuOpen: "Open sidebar",
    emptyTitle: "Start a conversation",
    emptyDesc: "I'm here to listen. How are you feeling today?",
    loading: "Loading conversations…",
    apiKeyMissing: "API key missing. Set ANTHROPIC_API_KEY in .env.local",
    limitReached: "Daily message limit reached. Come back tomorrow 💛",
    today: "Today",
    yesterday: "Yesterday",
    noConversations: "No conversations yet",
  },
  es: {
    title: "Compañero IA",
    subtitle: "Tu suave compañero de sanación",
    newChat: "Nueva charla",
    inputPlaceholder: "Comparte cómo te sientes…",
    menuOpen: "Abrir menú",
    emptyTitle: "Inicia una conversación",
    emptyDesc: "Estoy aquí para escuchar. ¿Cómo te sientes hoy?",
    loading: "Cargando conversaciones…",
    apiKeyMissing: "Falta API key. Configura ANTHROPIC_API_KEY en .env.local",
    limitReached: "Límite diario alcanzado. Vuelve mañana 💛",
    today: "Hoy",
    yesterday: "Ayer",
    noConversations: "Aún no hay conversaciones",
  },
  fr: {
    title: "Compagnon IA",
    subtitle: "Ton doux partenaire de guérison",
    newChat: "Nouvelle discussion",
    inputPlaceholder: "Partage ce que tu ressens…",
    menuOpen: "Ouvrir le menu",
    emptyTitle: "Commencer une conversation",
    emptyDesc: "Je suis là pour t'écouter. Comment te sens-tu aujourd'hui ?",
    loading: "Chargement des conversations…",
    apiKeyMissing: "Clé API manquante. Configurez ANTHROPIC_API_KEY dans .env.local",
    limitReached: "Limite quotidienne atteinte. Reviens demain 💛",
    today: "Aujourd'hui",
    yesterday: "Hier",
    noConversations: "Pas encore de conversations",
  },
};

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  emotion?: Emotion;
  timestamp: string;
};

type SSEEvent =
  | { type: "text_delta"; content: string }
  | { type: "emotion"; emotion: { type: Emotion["type"]; label: string } }
  | { type: "done" }
  | { type: "error"; code: string; message: string };

/* ═══════════════════════════════════════════
   Demo user（后续替换为真实鉴权）
   ═══════════════════════════════════════════ */
const DEMO_USER = "demo-user-001";

/* ═══════════════════════════════════════════
   SSE streaming client
   ═══════════════════════════════════════════ */
async function* streamChat(
  messages: { role: string; content: string }[],
  locale: string,
  userId: string,
): AsyncGenerator<SSEEvent> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, locale, userId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  if (!res.body) throw new Error("Response body is empty");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const raw = trimmed.slice(6);
        if (raw === "[DONE]") return;
        try { yield JSON.parse(raw) as SSEEvent; } catch { /* skip */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */
function now(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function buildMessagesPayload(msgs: Message[], newContent: string) {
  return [
    ...msgs.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: newContent },
  ];
}

function convDataToMessages(data: ConversationData): Message[] {
  return data.messages.map((m, i) => ({
    id: `m-${i}-${m.timestamp}`,
    role: m.role,
    content: m.content,
    emotion: m.emotion as Emotion | undefined,
    timestamp: m.timestamp,
  }));
}

/* ═══════════════════════════════════════════
   Page
   ═══════════════════════════════════════════ */
export default function ChatPage() {
  const locale = useLocale();
  const dict = t[locale] ?? t.en;

  /* ── UI state ── */
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  /* ── KV-backed state ── */
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConv, setIsLoadingConv] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* ── Init: load conversation list from KV ── */
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await initializeUser(DEMO_USER);
        if (cancelled) return;

        const list = await getUserConversations(DEMO_USER);
        if (cancelled) return;

        setConversations(list);

        /* Auto-select most recent conversation */
        if (list.length > 0) {
          setActiveId(list[0].id);
          const data = await getConversation(DEMO_USER, list[0].id);
          if (data && !cancelled) {
            setMessages(convDataToMessages(data));
          }
        }
      } catch (err) {
        console.error("[chat] Init error:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  /* ── Scroll to bottom ── */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  /* ── Reload sidebar ── */
  const reloadConversations = useCallback(async () => {
    try {
      const list = await getUserConversations(DEMO_USER);
      setConversations(list);
    } catch (err) {
      console.error("[chat] Failed to reload conversations:", err);
    }
  }, []);

  /* ── Select conversation ── */
  const handleSelect = useCallback(async (id: string) => {
    setActiveId(id);
    setStreamError(null);
    setIsLoadingConv(true);

    try {
      const data = await getConversation(DEMO_USER, id);
      if (data) {
        setMessages(convDataToMessages(data));
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error("[chat] Failed to load conversation:", err);
      setMessages([]);
    } finally {
      setIsLoadingConv(false);
    }

    setSidebarOpen(false);
  }, []);

  /* ── New conversation ── */
  const handleNew = useCallback(async () => {
    setStreamError(null);
    const id = `conv-${Date.now()}`;

    /* Save empty conversation to KV */
    const newConv: ConversationData = {
      id,
      userId: DEMO_USER,
      title: dict.newChat,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveConversation(DEMO_USER, newConv);
      await reloadConversations();
    } catch (err) {
      console.error("[chat] Failed to create conversation:", err);
    }

    setActiveId(id);
    setMessages([]);
    setSidebarOpen(false);
  }, [dict, reloadConversations]);

  /* ── Send message ── */
  const handleSend = useCallback(
    async (content: string) => {
      setIsSending(true);
      setStreamError(null);

      /* 1. Add user message */
      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        content,
        timestamp: now(),
      };

      setMessages((prev) => [...prev, userMsg]);

      /* 2. Add AI placeholder */
      const aiId = `a-${Date.now() + 1}`;
      const aiPlaceholder: Message = {
        id: aiId,
        role: "assistant",
        content: "",
        timestamp: now(),
      };

      setMessages((prev) => [...prev, aiPlaceholder]);

      let aiContent = "";
      let aiEmotion: Emotion | undefined;

      /* 3. Stream from API */
      try {
        const payload = buildMessagesPayload(messages, content);

        for await (const event of streamChat(payload, locale, DEMO_USER)) {
          switch (event.type) {
            case "text_delta":
              aiContent += event.content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiId ? { ...m, content: m.content + event.content } : m,
                ),
              );
              break;

            case "emotion":
              aiEmotion = {
                type: event.emotion.type as Emotion["type"],
                label: event.emotion.label,
              };
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiId ? { ...m, emotion: aiEmotion } : m,
                ),
              );
              break;

            case "error":
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiId
                    ? { ...m, content: m.content || `⚠️ ${event.message}` }
                    : m,
                ),
              );
              setStreamError(event.message);
              break;

            case "done":
              /* ── Save to KV ── */
              const allMsgs = [...messages, userMsg];
              const title =
                allMsgs.length === 0
                  ? content.slice(0, 30)
                  : allMsgs.find((m) => m.role === "user")?.content.slice(0, 30) ?? content.slice(0, 30);

              const conversation: ConversationData = {
                id: activeId ?? `conv-${Date.now()}`,
                userId: DEMO_USER,
                title: title.length > 30 ? title + "…" : title,
                messages: [
                  ...allMsgs.map((m) => ({
                    role: m.role,
                    content: m.content,
                    timestamp: m.timestamp,
                    emotion: m.emotion as Emotion | undefined,
                  })),
                  {
                    role: "assistant" as const,
                    content: aiContent,
                    timestamp: now(),
                    emotion: aiEmotion,
                  },
                ],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };

              saveConversation(DEMO_USER, conversation)
                .then(() => reloadConversations())
                .catch((e) => console.error("[chat] Save failed:", e));
              break;
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Connection failed";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId
              ? { ...m, content: m.content || `⚠️ ${msg}` }
              : m,
          ),
        );
        setStreamError(msg);
      } finally {
        setIsSending(false);
      }
    },
    [messages, locale, activeId, reloadConversations],
  );

  /* ── Sidebar labels ── */
  const sidebarLabels = {
    newChat: dict.newChat,
    search: "",
    today: dict.today,
    yesterday: dict.yesterday,
    noConversations: dict.noConversations,
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ═══ 侧边栏 ═══ */}
      <ChatSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelect}
        onNew={handleNew}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        labels={sidebarLabels}
      />

      {/* ═══ 右侧对话区 ═══ */}
      <main className="flex-1 flex flex-col min-w-0 h-full">
        {/* ── 顶部栏 ── */}
        <header
          className={cn(
            "shrink-0 flex items-center gap-3 px-4 md:px-6 py-3",
            "border-b border-border bg-surface/60 backdrop-blur-md",
          )}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-1 rounded-card text-warm-600 hover:text-foreground hover:bg-muted transition-colors duration-400"
            aria-label={dict.menuOpen}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-foreground truncate">{dict.title}</h1>
            <p className="text-xs text-warm-400 truncate">{dict.subtitle}</p>
          </div>

          {streamError && (
            <span className="hidden sm:inline text-xs text-blush-600 dark:text-blush-400 truncate max-w-[200px]" title={streamError}>
              ⚠ {streamError}
            </span>
          )}
        </header>

        {/* ── 消息滚动区 ── */}
        <div className={cn("flex-1 overflow-y-auto px-4 md:px-6 py-6", "scroll-smooth scroll-py-4", "chat-scrollbar")}>
          {isLoading || isLoadingConv ? (
            /* Loading state */
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-mint-400 animate-pulse [animation-delay:0ms]" />
                <span className="w-2.5 h-2.5 rounded-full bg-mint-400 animate-pulse [animation-delay:150ms]" />
                <span className="w-2.5 h-2.5 rounded-full bg-mint-400 animate-pulse [animation-delay:300ms]" />
              </div>
              <p className="text-sm text-warm-400">{dict.loading}</p>
            </div>
          ) : messages.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className={cn("w-20 h-20 rounded-full bg-mint-50 dark:bg-mint-950", "flex items-center justify-center mb-5", "shadow-soft-md")}>
                <svg className="w-10 h-10 text-mint-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                  <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                  <line x1="9" y1="9" x2="9.01" y2="9" />
                  <line x1="15" y1="9" x2="15.01" y2="9" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-1">{dict.emptyTitle}</h2>
              <p className="text-sm text-warm-500 max-w-xs">{dict.emptyDesc}</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              {messages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  emotion={msg.emotion}
                  timestamp={msg.timestamp}
                />
              ))}

              {isSending && (
                <div className="flex items-start my-3">
                  <div className="flex items-center gap-2 px-5 py-3 rounded-bubble rounded-tl-md bg-muted shadow-soft-sm">
                    <span className="w-2 h-2 rounded-full bg-mint-400 animate-pulse [animation-delay:0ms]" />
                    <span className="w-2 h-2 rounded-full bg-mint-400 animate-pulse [animation-delay:150ms]" />
                    <span className="w-2 h-2 rounded-full bg-mint-400 animate-pulse [animation-delay:300ms]" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ── 底部输入框 ── */}
        <ChatInput
          onSend={handleSend}
          disabled={isSending || isLoading}
          placeholder={dict.inputPlaceholder}
        />
      </main>

      {/* ── 滚动条 ── */}
      <style jsx>{`
        .chat-scrollbar::-webkit-scrollbar { width: 4px; }
        .chat-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .chat-scrollbar::-webkit-scrollbar-thumb { background: hsl(35, 5%, 75%); border-radius: 999px; }
        .chat-scrollbar::-webkit-scrollbar-thumb:hover { background: hsl(35, 5%, 60%); }
        @media (prefers-color-scheme: dark) {
          .chat-scrollbar::-webkit-scrollbar-thumb { background: hsl(35, 5%, 35%); }
          .chat-scrollbar::-webkit-scrollbar-thumb:hover { background: hsl(35, 5%, 50%); }
        }
      `}</style>
    </div>
  );
}
