"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

/* ── types ── */
type ButtonVariant = "primary" | "secondary" | "outline";
type ButtonSize   = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  className?: string;
  children: ReactNode;
}

/* ── helpers ── */
function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

const Spinner = () => (
  <svg
    className="animate-spin h-4 w-4 shrink-0"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle
      className="opacity-20"
      cx="12" cy="12" r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-70"
      fill="currentColor"
      d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
    />
  </svg>
);

/* ── variant → classes ── */
const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-mint-500 text-white hover:bg-mint-600 active:bg-mint-700 " +
    "shadow-soft-sm hover:shadow-soft-md " +
    "disabled:bg-mint-300 dark:disabled:bg-mint-800",

  secondary:
    "bg-muted text-foreground border border-border " +
    "hover:bg-warm-200 dark:hover:bg-warm-700 " +
    "active:bg-warm-300 dark:active:bg-warm-600 " +
    "disabled:opacity-50",

  outline:
    "bg-transparent text-mint-600 dark:text-mint-400 " +
    "border-2 border-mint-400 dark:border-mint-600 " +
    "hover:bg-mint-50 dark:hover:bg-mint-950 " +
    "active:bg-mint-100 dark:active:bg-mint-900 " +
    "disabled:opacity-40",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm gap-1.5 rounded-card",
  md: "px-5 py-2.5 text-base gap-2 rounded-card",
  lg: "px-7 py-3.5 text-lg gap-2.5 rounded-card",
};

/* ── component ── */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    disabled,
    className,
    children,
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      className={cn(
        /* base */
        "inline-flex items-center justify-center font-medium",
        "select-none outline-none",
        "transition-all duration-400 ease-out",
        "focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:ring-offset-2",
        "active:scale-[0.98]",
        "disabled:cursor-not-allowed",
        /* variant + size */
        variantClasses[variant],
        sizeClasses[size],
        /* user override */
        className,
      )}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
});

export default Button;
