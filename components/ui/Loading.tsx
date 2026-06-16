import { type HTMLAttributes } from "react";

/* ── types ── */
type LoadingSize  = "sm" | "md" | "lg";
type LoadingColor = "mint" | "warm" | "blush" | "breeze";

interface LoadingProps extends HTMLAttributes<HTMLDivElement> {
  size?: LoadingSize;
  color?: LoadingColor;
  className?: string;
}

/* ── helpers ── */
function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

const dotSizes: Record<LoadingSize, string> = {
  sm: "w-1.5 h-1.5 gap-1",
  md: "w-2.5 h-2.5 gap-1.5",
  lg: "w-3.5 h-3.5 gap-2",
};

const dotColors: Record<LoadingColor, string> = {
  mint:   "bg-mint-500",
  warm:   "bg-warm-500",
  blush:  "bg-blush-500",
  breeze: "bg-breeze-500",
};

/* ── component ── */
export default function Loading({
  size = "md",
  color = "mint",
  className,
  ...rest
}: LoadingProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center",
        dotSizes[size].split(" ")[2], // gap value
        className,
      )}
      role="status"
      aria-label="Loading"
      {...rest}
    >
      <span
        className={cn(
          "rounded-full",
          dotSizes[size].split(" ")[0], // w
          dotSizes[size].split(" ")[1], // h
          dotColors[color],
          "animate-pulse",
          "[animation-delay:0ms]",
        )}
      />
      <span
        className={cn(
          "rounded-full",
          dotSizes[size].split(" ")[0],
          dotSizes[size].split(" ")[1],
          dotColors[color],
          "animate-pulse",
          "[animation-delay:150ms]",
        )}
      />
      <span
        className={cn(
          "rounded-full",
          dotSizes[size].split(" ")[0],
          dotSizes[size].split(" ")[1],
          dotColors[color],
          "animate-pulse",
          "[animation-delay:300ms]",
        )}
      />
      <span className="sr-only">Loading...</span>
    </div>
  );
}
