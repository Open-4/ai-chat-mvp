import { type HTMLAttributes } from "react";

/* ── types ── */
type SkeletonVariant = "text" | "circular" | "rectangular";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** 骨架形状 */
  variant?: SkeletonVariant;
  /** 文本行数（仅 variant="text" 时生效） */
  lines?: number;
  /** 固定宽度 */
  width?: string | number;
  /** 固定高度 */
  height?: string | number;
  className?: string;
}

/* ── helpers ── */
function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

/* ── skeleton bar ── */
function Bar({
  width: w,
  height: h,
  className,
}: {
  width?: string | number;
  height?: string | number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "animate-pulse bg-muted rounded",
        className,
      )}
      style={{ width: w, height: h }}
      aria-hidden="true"
    />
  );
}

/* ── component ── */
export default function Skeleton({
  variant = "text",
  lines = 3,
  width,
  height,
  className,
  ...rest
}: SkeletonProps) {
  /* ── circular (头像) ── */
  if (variant === "circular") {
    const size = width ?? height ?? 48;
    return (
      <Bar
        width={size}
        height={size}
        className={cn("rounded-full", className)}
      />
    );
  }

  /* ── rectangular (图片 / 卡片) ── */
  if (variant === "rectangular") {
    return (
      <Bar
        width={width ?? "100%"}
        height={height ?? 160}
        className={cn("rounded-card", className)}
      />
    );
  }

  /* ── text (多行段落) ── */
  const widths = Array.from({ length: lines }, (_, i) => {
    if (i === lines - 1 && lines > 1) return "60%"; // 末行短
    return `${85 + Math.floor(Math.random() * 15)}%`;
  });

  return (
    <div
      className={cn("flex flex-col gap-2.5 w-full", className)}
      {...rest}
    >
      {widths.map((w, i) => (
        <Bar key={i} width={w} height={14} className="rounded" />
      ))}
    </div>
  );
}
