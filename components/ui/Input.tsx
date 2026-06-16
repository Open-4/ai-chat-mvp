"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

/* ── types ── */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** 错误提示文案 — 出现时边框变红 */
  error?: string;
  className?: string;
}

/* ── helpers ── */
function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

/* ── component ── */
const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { error, className, disabled, ...rest },
  ref,
) {
  return (
    <div className="w-full">
      <input
        ref={ref}
        disabled={disabled}
        className={cn(
          /* base */
          "w-full px-4 py-3 text-base",
          "bg-surface text-foreground",
          "placeholder:text-warm-400 dark:placeholder:text-warm-500",
          "border rounded-bubble",
          "outline-none",
          "transition-all duration-400 ease-out",
          /* idle */
          "border-border",
          /* hover */
          "hover:border-warm-400 dark:hover:border-warm-500",
          /* focus */
          "focus:border-mint-400 focus:shadow-soft-sm",
          /* error */
          error &&
            "border-blush-400 dark:border-blush-500 " +
            "focus:border-blush-500 focus:shadow-[0_0_0_3px_hsl(6_72%_70%/0.15)]",
          /* disabled */
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border",
          /* user */
          className,
        )}
        aria-invalid={!!error}
        aria-describedby={error ? `${rest.id ?? rest.name}-error` : undefined}
        {...rest}
      />

      {error && (
        <p
          id={`${rest.id ?? rest.name}-error`}
          className="mt-1.5 text-sm text-blush-600 dark:text-blush-400"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
});

export default Input;
