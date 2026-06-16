"use client";

import {
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
} from "react";

/* ── types ── */
interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

/* ── helpers ── */
function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

/* ── component ── */
export default function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Type your message...",
  className,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ── 发送 ── */
  const send = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const content = el.value.trim();
    if (!content || disabled) return;
    onSend(content);
    el.value = "";
    /* 重置高度 */
    el.style.height = "auto";
  }, [onSend, disabled]);

  /* ── 键盘：Enter 发送，Shift+Enter 换行 ── */
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  /* ── 自动撑高 ── */
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.addEventListener("input", autoResize);
    return () => el.removeEventListener("input", autoResize);
  }, [autoResize]);

  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 w-full",
        "bg-gradient-to-t from-background via-background/95 to-transparent",
        "pt-4 pb-4 px-4 md:px-6",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-end gap-2 max-w-3xl mx-auto",
          "bg-surface border border-border",
          "rounded-bubble shadow-soft-md",
          "transition-all duration-400 ease-out",
          "focus-within:border-mint-400 focus-within:shadow-soft-lg",
          disabled && "opacity-60",
        )}
      >
        {/* 输入区 */}
        <textarea
          ref={textareaRef}
          rows={1}
          disabled={disabled}
          placeholder={placeholder}
          onKeyDown={handleKeyDown}
          className={cn(
            "flex-1 resize-none bg-transparent px-4 py-3",
            "text-sm text-foreground placeholder:text-warm-400",
            "outline-none",
            "max-h-40",
            "disabled:cursor-not-allowed",
          )}
          aria-label={placeholder}
        />

        {/* 发送按钮 */}
        <button
          type="button"
          onClick={send}
          disabled={disabled}
          className={cn(
            "shrink-0 m-1.5 p-2.5 rounded-full",
            "bg-mint-500 text-white",
            "hover:bg-mint-600 active:bg-mint-700",
            "disabled:bg-mint-300 dark:disabled:bg-mint-800",
            "transition-all duration-400 ease-out",
            "focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:ring-offset-2",
            "active:scale-95",
            "disabled:cursor-not-allowed",
          )}
          aria-label="Send message"
        >
          {/* 纸飞机图标 */}
          <svg
            className="w-4 h-4 -ml-0.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
