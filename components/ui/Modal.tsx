"use client";

import {
  useEffect,
  useState,
  useCallback,
  type ReactNode,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";

/* ── types ── */
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** 点击遮罩是否关闭，默认 true */
  closeOnBackdrop?: boolean;
  className?: string;
  children: ReactNode;
}

/* ── helpers ── */
function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

/* ── component ── */
export default function Modal({
  open,
  onClose,
  title,
  closeOnBackdrop = true,
  className,
  children,
}: ModalProps) {
  /* 分两阶段控制：mounted 决定 DOM 是否存在，show 触发 CSS 过渡 */
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      /* rAF 确保 DOM 先挂载再触发过渡 */
      const raf = requestAnimationFrame(() => setShow(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setShow(false);
      const timer = setTimeout(() => setMounted(false), 350);
      return () => clearTimeout(timer);
    }
  }, [open]);

  /* ── Escape 关闭 ── */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  /* ── 禁止 body 滚动 ── */
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  /* ── 遮罩点击 ── */
  const handleBackdrop = (e: MouseEvent) => {
    if (closeOnBackdrop && e.target === e.currentTarget) onClose();
  };

  /* SSR 阶段不渲染 */
  if (!mounted) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4",
        "bg-warm-950/30 dark:bg-black/50",
        "backdrop-blur-sm",
        "transition-opacity duration-300 ease-out",
        show ? "opacity-100" : "opacity-0",
      )}
      onClick={handleBackdrop}
      aria-modal="true"
      role="dialog"
      aria-label={title ?? "Dialog"}
    >
      {/* 卡片 */}
      <div
        className={cn(
          "relative w-full max-w-lg max-h-[85vh] overflow-y-auto",
          "bg-surface border border-border",
          "rounded-card shadow-soft-xl",
          "transition-all duration-300 ease-out",
          show
            ? "scale-100 translate-y-0 opacity-100"
            : "scale-95 translate-y-4 opacity-0",
          className,
        )}
      >
        {/* header */}
        {title && (
          <div className="flex items-center justify-between px-6 pt-6 pb-3">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <button
              onClick={onClose}
              className={cn(
                "inline-flex items-center justify-center w-8 h-8 rounded-full",
                "text-warm-500 hover:text-foreground",
                "hover:bg-muted",
                "transition-colors duration-400 ease-out",
              )}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        )}

        {/* body */}
        <div className={cn(!title && "pt-6", "px-6 pb-6")}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
