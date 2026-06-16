"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import ChatSidebar, { type ConversationItem } from "./_components/ChatSidebar";
import ChatBubble, { type Emotion } from "./_components/ChatBubble";
import ChatInput from "./_components/ChatInput";

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
    search: "Search conversations…",
    today: "Today",
    yesterday: "Yesterday",
    noConversations: "No conversations yet",
    inputPlaceholder: "Share how you feel…",
    emotionPositive: "Warm",
    emotionGentle: "Tender",
    emotionCalm: "Calm",
    menuOpen: "Open sidebar",
    emptyTitle: "Start a conversation",
    emptyDesc: "I'm here to listen. How are you feeling today?",
    apiKeyMissing: "API key not configured. Add ANTHROPIC_API_KEY to .env.local",
  },
  es: {
    title: "Compañero IA",
    subtitle: "Tu suave compañero de sanación",
    newChat: "Nueva charla",
    search: "Buscar conversaciones…",
    today: "Hoy",
    yesterday: "Ayer",
    noConversations: "Aún no hay conversaciones",
    inputPlaceholder: "Comparte cómo te sientes…",
    emotionPositive: "Cálido",
    emotionGentle: "Tierno",
    emotionCalm: "Calma",
    menuOpen: "Abrir menú",
    emptyTitle: "Inicia una conversación",
    emptyDesc: "Estoy aquí para escuchar. ¿Cómo te sientes hoy?",
    apiKeyMissing: "API key no configurada. Agrega ANTHROPIC_API_KEY a .env.local",
  },
  fr: {
    title: "Compagnon IA",
    subtitle: "Ton doux partenaire de guérison",
    newChat: "Nouvelle discussion",
    search: "Rechercher des conversations…",
    today: "Aujourd'hui",
    yesterday: "Hier",
    noConversations: "Pas encore de conversations",
    inputPlaceholder: "Partage ce que tu ressens…",
    emotionPositive: "Chaleureux",
    emotionGentle: "Tendre",
    emotionCalm: "Calme",
    menuOpen: "Ouvrir le menu",
    emptyTitle: "Commencer une conversation",
    emptyDesc: "Je suis là pour t'écouter. Comment te sens-tu aujourd'hui ?",
    apiKeyMissing: "Clé API non configurée. Ajoutez ANTHROPIC_API_KEY à .env.local",
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
   SSE streaming API client
   ═══════════════════════════════════════════ */
async function* streamChat(
  messages: { role: string; content: string }[],
  locale: string,
): AsyncGenerator<SSEEvent> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, locale }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  if (!res.body) {
    throw new Error("Response body is empty");
  }

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

        try {
          yield JSON.parse(raw) as SSEEvent;
        } catch {
          /* skip unparseable chunks */
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/* ═══════════════════════════════════════════
   Helper: build shared messages array
   ═══════════════════════════════════════════ */
function buildMessagesPayload(
  msgs: Message[],
  newUserContent: string,
): { role: string; content: string }[] {
  return [
    ...msgs.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: newUserContent },
  ];
}

/* ═══════════════════════════════════════════
   Page
   ═══════════════════════════════════════════ */
export default function ChatPage() {
  const { locale } = useParams<{ locale: string }>();
  const dict = t[locale] ?? t.en;

  /* ── state ── */
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  /* keep a simple conversations list in-memory */
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* ── scroll to bottom ── */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  /* ── create new conversation ── */
  const handleNew = useCallback(() => {
    abortRef.current?.abort(); // cancel any in-flight request

    const id = `conv-${Date.now()}`;
    const newConv: ConversationItem = {
      id,
      title: dict.newChat,
      lastMessage: "",
      date: dict.today,
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveId(id);
    setMessages([]);
    setStreamError(null);
    setSidebarOpen(false);
  }, [dict]);

  /* ── select conversation ── */
  const handleSelect = useCallback((id: string) => {
    setActiveId(id);
    setMessages([]); // MVP: messages not persisted across sessions yet
    setStreamError(null);
    setSidebarOpen(false);
  }, []);

  /* ── send message ── */
  const handleSend = useCallback(
    async (content: string) => {
      setIsSending(true);
      setStreamError(null);

      const now = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      /* 1. add user message */
      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        content,
        timestamp: now,
      };

      setMessages((prev) => [...prev, userMsg]);

      /* 2. add AI placeholder */
      const aiId = `a-${Date.now() + 1}`;
      const aiPlaceholder: Message = {
        id: aiId,
        role: "assistant",
        content: "",
        timestamp: now,
      };

      setMessages((prev) => [...prev, aiPlaceholder]);

      /* 3. stream from API */
      try {
        const payload = buildMessagesPayload(messages, content);

        for await (const event of streamChat(payload, locale)) {
          switch (event.type) {
            case "text_delta":
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiId
                    ? { ...m, content: m.content + event.content }
                    : m,
                ),
              );
              break;

            case "emotion":
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiId
                    ? {
                        ...m,
                        emotion: {
                          type: event.emotion.type as Emotion["type"],
                          label: event.emotion.label,
                        },
                      }
                    : m,
                ),
              );
              break;

            case "error":
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiId
                    ? {
                        ...m,
                        content:
                          m.content ||
                          `⚠️ ${event.message}`,
                      }
                    : m,
                ),
              );
              setStreamError(event.message);
              break;

            case "done":
              /* stream complete */
              break;
          }
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Connection failed";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId
              ? {
                  ...m,
                  content:
                    m.content ||
                    `⚠️ ${msg}. ${dict.apiKeyMissing}`,
                }
              : m,
          ),
        );
        setStreamError(msg);
      } finally {
        setIsSending(false);

        /* update conversation title from first user message */
        if (messages.length === 0) {
          const title =
            content.length > 30 ? content.slice(0, 30) + "…" : content;
          setConversations((prev) =>
            prev.map((c) =>
              c.id === activeId ? { ...c, title, lastMessage: content } : c,
            ),
          );
        } else {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === activeId
                ? { ...c, lastMessage: content }
                : c,
            ),
          );
        }
      }
    },
    [messages, locale, activeId, dict],
  );

  /* ── sidebar labels ── */
  const sidebarLabels = {
    newChat: dict.newChat,
    search: dict.search,
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
            className={cn(
              "lg:hidden p-2 -ml-1 rounded-card",
              "text-warm-600 hover:text-foreground hover:bg-muted",
              "transition-colors duration-400",
            )}
            aria-label={dict.menuOpen}
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-foreground truncate">
              {dict.title}
            </h1>
            <p className="text-xs text-warm-400 truncate">{dict.subtitle}</p>
          </div>

          {/* stream error indicator */}
          {streamError && (
            <span
              className="hidden sm:inline text-xs text-blush-600 dark:text-blush-400 truncate max-w-[200px]"
              title={streamError}
            >
              ⚠ {streamError}
            </span>
          )}
        </header>

        {/* ── 消息滚动区 ── */}
        <div
          className={cn(
            "flex-1 overflow-y-auto px-4 md:px-6 py-6",
            "scroll-smooth scroll-py-4",
            "chat-scrollbar",
          )}
        >
          {messages.length === 0 ? (
            /* 空状态 */
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div
                className={cn(
                  "w-20 h-20 rounded-full bg-mint-50 dark:bg-mint-950",
                  "flex items-center justify-center mb-5",
                  "shadow-soft-md",
                )}
              >
                <svg
                  className="w-10 h-10 text-mint-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                >
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                  <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                  <line x1="9" y1="9" x2="9.01" y2="9" />
                  <line x1="15" y1="9" x2="15.01" y2="9" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-1">
                {dict.emptyTitle}
              </h2>
              <p className="text-sm text-warm-500 max-w-xs">
                {dict.emptyDesc}
              </p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              {messages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  emotion={
                    msg.emotion
                      ? {
                          type: msg.emotion.type,
                          label: msg.emotion.label,
                        }
                      : undefined
                  }
                  timestamp={msg.timestamp}
                />
              ))}

              {/* loading indicator when streaming */}
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
          disabled={isSending}
          placeholder={dict.inputPlaceholder}
        />
      </main>

      {/* ── 自定义滚动条 + 消息淡入 ── */}
      <style jsx>{`
        .chat-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .chat-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .chat-scrollbar::-webkit-scrollbar-thumb {
          background: hsl(35, 5%, 75%);
          border-radius: 999px;
        }
        .chat-scrollbar::-webkit-scrollbar-thumb:hover {
          background: hsl(35, 5%, 60%);
        }
        @media (prefers-color-scheme: dark) {
          .chat-scrollbar::-webkit-scrollbar-thumb {
            background: hsl(35, 5%, 35%);
          }
          .chat-scrollbar::-webkit-scrollbar-thumb:hover {
            background: hsl(35, 5%, 50%);
          }
        }
        @keyframes msgFadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .msg-enter {
          animation: msgFadeIn 350ms ease-out both;
        }
      `}</style>
    </div>
  );
}
