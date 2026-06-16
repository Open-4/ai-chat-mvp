import { type HTMLAttributes, type ReactNode } from "react";

/* ── types ── */
type BadgeVariant = "positive" | "gentle" | "calm" | "neutral";
type BadgeSize    = "sm" | "md";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
  children: ReactNode;
}

/* ── helpers ── */
function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

/* ── variant → classes ── */
const variantClasses: Record<BadgeVariant, string> = {
  positive:
    "bg-mint-100 text-mint-700 " +
    "dark:bg-mint-900 dark:text-mint-300",

  gentle:
    "bg-blush-100 text-blush-700 " +
    "dark:bg-blush-900 dark:text-blush-300",

  calm:
    "bg-breeze-100 text-breeze-700 " +
    "dark:bg-breeze-900 dark:text-breeze-300",

  neutral:
    "bg-warm-100 text-warm-700 " +
    "dark:bg-warm-800 dark:text-warm-300",
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-3 py-1 text-sm",
};

/* ── component ── */
export default function Badge({
  variant = "neutral",
  size = "md",
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        /* base */
        "inline-flex items-center font-medium",
        "rounded-bubble",
        "transition-colors duration-400 ease-out",
        /* variant + size */
        variantClasses[variant],
        sizeClasses[size],
        /* user override */
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
