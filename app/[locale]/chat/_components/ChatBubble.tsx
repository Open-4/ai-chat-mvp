"use client";

import type { ReactNode } from "react";

/* ── types ── */
export interface Emotion {
  type: "positive" | "gentle" | "calm";
  label: string;
}

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  emotion?: Emotion;
  timestamp?: string;
  className?: string;
}

/* ── helpers ── */
function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

const emotionDot: Record<Emotion["type"], string> = {
  positive: "bg-mint-400",
  gentle: "bg-blush-400",
  calm: "bg-breeze-400",
};

const emotionRing: Record<Emotion["type"], string> = {
  positive: "ring-mint-400/20",
  gentle: "ring-blush-400/20",
  calm: "ring-breeze-400/20",
};

/* ── component ── */
export default function ChatBubble({
  role,
  content,
  emotion,
  timestamp,
  className,
}: ChatBubbleProps) {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex flex-col w-full my-3 first:mt-0 last:mb-0",
        isUser ? "items-end" : "items-start",
        className,
      )}
    >
      {/* ── 情绪标签（仅 AI） ── */}
      {!isUser && emotion && (
        <div
          className={cn(
            "inline-flex items-center gap-1.5 mb-1.5 ml-1",
            "px-2 py-0.5 rounded-bubble text-xs font-medium",
            "bg-surface border border-border",
            "ring-1 ring-inset",
            emotionRing[emotion.type],
          )}
        >
          <span
            className={cn(
              "inline-block w-2 h-2 rounded-full shrink-0",
              emotionDot[emotion.type],
            )}
            aria-hidden="true"
          />
          <span className="text-warm-600 dark:text-warm-400">
            {emotion.label}
          </span>
        </div>
      )}

      {/* ── 气泡主体 ── */}
      <div
        className={cn(
          "relative max-w-[78%] md:max-w-[65%] px-5 py-3 text-sm leading-relaxed",
          "transition-all duration-400 ease-out",
          "hover:shadow-soft-md",
          /* 用户：薄荷绿底白字，靠右 */
          isUser
            ? "bg-mint-500 text-white rounded-bubble rounded-tr-md shadow-soft-sm"
            : /* AI：暖灰底，靠左 */
              "bg-muted text-foreground rounded-bubble rounded-tl-md shadow-soft-sm",
        )}
      >
        {/* 小三角 */}
        <span
          className={cn(
            "absolute top-0 w-2.5 h-2.5",
            isUser
              ? "-right-1 bg-mint-500 [clip-path:polygon(0_0,100%_100%,100%_0)]"
              : "-left-1 bg-muted [clip-path:polygon(0_0,100%_0,0_100%)]",
          )}
          aria-hidden="true"
        />

        <p className="whitespace-pre-wrap break-words">{content}</p>
      </div>

      {/* ── 时间戳 ── */}
      {timestamp && (
        <time
          className={cn(
            "mt-1 text-[10px] text-warm-400 dark:text-warm-500",
            isUser ? "mr-1" : "ml-1",
          )}
        >
          {timestamp}
        </time>
      )}
    </div>
  );
}
