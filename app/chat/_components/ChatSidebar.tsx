"use client";

import { useEffect, useCallback, type MouseEvent } from "react";

/* ── types ── */
export interface ConversationItem {
  id: string;
  title: string;
  lastMessage: string;
  date: string;
}

interface ChatSidebarProps {
  conversations: ConversationItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  isOpen: boolean;
  onClose: () => void;
  labels: {
    newChat: string;
    search: string;
    today: string;
    yesterday: string;
    noConversations: string;
  };
}

/* ── helpers ── */
function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

/* ── component ── */
export default function ChatSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  isOpen,
  onClose,
  labels,
}: ChatSidebarProps) {
  /* ── Escape 关闭 ── */
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKey);
      return () => document.removeEventListener("keydown", handleKey);
    }
  }, [isOpen, handleKey]);

  const sidebarContent = (
    <aside
      className={cn(
        "flex flex-col h-full",
        "bg-surface border-r border-border",
        "w-[260px]",
      )}
    >
      {/* ── 新建对话按钮 ── */}
      <div className="p-3 border-b border-border">
        <button
          onClick={onNew}
          className={cn(
            "w-full flex items-center gap-2 px-4 py-2.5",
            "bg-mint-50 dark:bg-mint-950",
            "text-mint-700 dark:text-mint-300",
            "border border-mint-200 dark:border-mint-800",
            "rounded-card font-medium text-sm",
            "hover:bg-mint-100 dark:hover:bg-mint-900",
            "active:bg-mint-200 dark:active:bg-mint-800",
            "transition-all duration-400 ease-out",
            "focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:ring-offset-2",
          )}
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {labels.newChat}
        </button>
      </div>

      {/* ── 会话列表 ── */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-warm-400">
            {labels.noConversations}
          </p>
        ) : (
          <ul className="p-2 space-y-0.5">
            {conversations.map((conv) => (
              <li key={conv.id}>
                <button
                  onClick={() => onSelect(conv.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-card",
                    "transition-all duration-300 ease-out",
                    "hover:bg-muted",
                    activeId === conv.id
                      ? "bg-mint-50 dark:bg-mint-950 border border-mint-200 dark:border-mint-800"
                      : "border border-transparent",
                  )}
                >
                  <p className="text-sm font-medium text-foreground truncate">
                    {conv.title}
                  </p>
                  <p className="text-xs text-warm-500 dark:text-warm-400 truncate mt-0.5">
                    {conv.lastMessage}
                  </p>
                  <p className="text-[10px] text-warm-400 mt-1">
                    {conv.date}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── 底部品牌 ── */}
      <div className="px-4 py-3 border-t border-border">
        <p className="text-[10px] text-warm-400 text-center">
          AI Companion · MVP
        </p>
      </div>
    </aside>
  );

  return (
    <>
      {/* ══════ 桌面端：固定侧边栏 ══════ */}
      <div className="hidden lg:block shrink-0 h-full">{sidebarContent}</div>

      {/* ══════ 移动端：遮罩 + 抽屉 ══════ */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          {/* 遮罩 */}
          <div
            className="absolute inset-0 bg-warm-950/30 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* 抽屉面板 */}
          <div
            className={cn(
              "absolute left-0 top-0 bottom-0 z-50",
              "animate-[slideIn_250ms_ease-out]",
            )}
          >
            {sidebarContent}
          </div>
        </div>
      )}

      {/* 移动端抽屉滑入动画 */}
      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}
