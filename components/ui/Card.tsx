import { type HTMLAttributes, type ReactNode } from "react";

/* ── types ── */
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** 内边距预设 */
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
  children: ReactNode;
}

/* ── helpers ── */
function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

/* ── padding map ── */
const paddingClasses: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "",
  sm: "p-3",
  md: "p-5",
  lg: "p-8",
};

/* ── component ── */
export default function Card({
  padding = "md",
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        /* card base */
        "bg-surface border border-border",
        "rounded-card",
        "shadow-soft-md",
        "transition-shadow duration-400 ease-out",
        "hover:shadow-soft-lg",
        /* padding */
        paddingClasses[padding],
        /* user override */
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
