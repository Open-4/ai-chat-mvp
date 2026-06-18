"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useLocale } from "@/lib/use-locale";
import Link from "next/link";

/* ── constants ── */
const PHASES = {
  inhale:  { duration: 4, label: { en: "Breathe In",     es: "Inhala",         fr: "Inspire" },   guide: { en: "Slowly through your nose", es: "Lentamente por la nariz", fr: "Doucement par le nez" } },
  hold:    { duration: 4, label: { en: "Hold",           es: "Sostén",         fr: "Retiens" },    guide: { en: "Let the calm settle in",  es: "Deja que la calma entre",  fr: "Laisse le calme s'installer" } },
  exhale:  { duration: 6, label: { en: "Breathe Out",    es: "Exhala",         fr: "Expire" },     guide: { en: "Gently through your mouth",es:"Suavemente por la boca",   fr:"Doucement par la bouche" } },
} as const;

type PhaseKey = keyof typeof PHASES;
const TOTAL_CYCLE = PHASES.inhale.duration + PHASES.hold.duration + PHASES.exhale.duration; // 14s

/* ── helpers ── */
function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

/* ═══════════════════════════════════════════
   Page
   ═══════════════════════════════════════════ */
export default function BreathePage() {
  const locale = useLocale();
  const l = (obj: Record<string, string>) => obj[locale] ?? obj.en;

  /* state */
  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState<PhaseKey>("inhale");
  const [timeLeft, setTimeLeft] = useState(PHASES.inhale.duration);
  const [scale, setScale] = useState(0.7);
  const [cycles, setCycles] = useState(0);
  const [opacity, setOpacity] = useState(0);

  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  /* ── fade in on mount ── */
  useEffect(() => {
    requestAnimationFrame(() => setOpacity(1));
  }, []);

  /* ── animation loop ── */
  const tick = useCallback((now: number) => {
    if (!startRef.current) startRef.current = now;
    const elapsed = (now - startRef.current) / 1000;
    const cycleTime = elapsed % TOTAL_CYCLE;

    let p: PhaseKey;
    let progress: number;

    if (cycleTime < PHASES.inhale.duration) {
      p = "inhale";
      progress = cycleTime / PHASES.inhale.duration;
    } else if (cycleTime < PHASES.inhale.duration + PHASES.hold.duration) {
      p = "hold";
      progress = (cycleTime - PHASES.inhale.duration) / PHASES.hold.duration;
    } else {
      p = "exhale";
      progress = (cycleTime - PHASES.inhale.duration - PHASES.hold.duration) / PHASES.exhale.duration;
    }

    const s =
      p === "inhale"  ? 0.7 + progress * 0.55 :
      p === "hold"    ? 1.25 :
      /* exhale */       1.25 - progress * 0.55;

    setPhase(p);
    setTimeLeft(Math.ceil(PHASES[p].duration - progress * PHASES[p].duration));
    setScale(s);
    setCycles(Math.floor(elapsed / TOTAL_CYCLE));

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (isRunning) {
      startRef.current = 0;
      rafRef.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [isRunning, tick]);

  /* ── controls ── */
  const toggle = () => setIsRunning((v) => !v);
  const reset = () => {
    setIsRunning(false);
    setPhase("inhale");
    setTimeLeft(PHASES.inhale.duration);
    setScale(0.7);
    setCycles(0);
    startRef.current = 0;
  };

  /* ── glow intensity ── */
  const glowAlpha = 0.15 + scale * 0.2;
  const glowColor = phase === "exhale"
    ? `rgba(174,214,241,${glowAlpha})`  /* breeze */
    : phase === "hold"
    ? `rgba(245,183,177,${glowAlpha})`  /* blush */
    : `rgba(101,195,169,${glowAlpha})`; /* mint */

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center min-h-screen bg-background px-6 py-8",
        "transition-opacity duration-700 ease-out",
        opacity === 1 ? "opacity-100" : "opacity-0",
      )}
    >
      {/* ── back link ── */}
      <Link
        href={`/${locale}`}
        className="absolute top-6 left-6 text-warm-400 hover:text-foreground transition-colors duration-400"
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </Link>

      {/* ── cycle counter ── */}
      <p className="text-xs text-warm-400 mb-8 tracking-wide uppercase">
        {cycles > 0 ? `Cycle ${cycles}` : "Ready"}
      </p>

      {/* ═══ Breathing circle ═══ */}
      <div className="relative flex items-center justify-center mb-8 md:mb-10">
        {/* outer glow rings */}
        <div
          className="absolute rounded-full transition-all duration-500"
          style={{
            width: "min(320px, 85vw)",
            height: "min(320px, 85vw)",
            boxShadow: `
              0 0 80px ${glowColor},
              0 0 160px ${glowColor.replace(String(glowAlpha), String(glowAlpha * 0.5))},
              0 0 240px ${glowColor.replace(String(glowAlpha), String(glowAlpha * 0.25))}
            `,
          }}
        />

        {/* animated circle */}
        <div
          className="relative flex items-center justify-center rounded-full transition-all duration-200 ease-linear"
          style={{
            width: "min(200px, 55vw)",
            height: "min(200px, 55vw)",
            transform: `scale(${scale})`,
            background: "radial-gradient(circle at 40% 35%, hsl(163,44%,72%), hsl(163,44%,58%))",
            boxShadow: `
              0 0 40px ${glowColor},
              inset 0 0 30px rgba(255,255,255,0.1)
            `,
          }}
        >
          {/* inner light spot */}
          <div
            className="absolute rounded-full"
            style={{
              width: "30%",
              height: "30%",
              top: "20%",
              left: "25%",
              background: "radial-gradient(circle, rgba(255,255,255,0.4), transparent)",
            }}
          />

          {/* timer + label */}
          <div className="relative z-10 flex flex-col items-center text-white">
            <span className="text-4xl font-light tabular-nums leading-none">
              {timeLeft}
            </span>
            <span className="text-xs mt-1 opacity-80 tracking-wide uppercase">
              {l(PHASES[phase].label)}
            </span>
          </div>
        </div>
      </div>

      {/* ── text guide ── */}
      <p className="text-base text-warm-500 dark:text-warm-400 mb-10 text-center min-h-[3rem] transition-opacity duration-500">
        {isRunning ? l(PHASES[phase].guide) : "Press start to begin"}
      </p>

      {/* ── controls ── */}
      <div className="flex items-center gap-4">
        <button
          onClick={reset}
          className={cn(
            "px-5 py-2.5 rounded-card text-sm font-medium",
            "border border-border text-warm-500 hover:text-foreground",
            "hover:bg-muted transition-all duration-400",
          )}
        >
          Reset
        </button>

        <button
          onClick={toggle}
          className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center",
            "text-white font-medium",
            "shadow-soft-lg hover:shadow-soft-xl",
            "transition-all duration-400 ease-out",
            "active:scale-95",
            isRunning
              ? "bg-warm-400 hover:bg-warm-500"
              : "bg-mint-500 hover:bg-mint-600",
          )}
          aria-label={isRunning ? "Pause" : "Start"}
        >
          {isRunning ? (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="w-5 h-5 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6,3 20,12 6,21" />
            </svg>
          )}
        </button>
      </div>

      {/* ── rhythm indicator ── */}
      <div className="flex items-center gap-3 mt-10">
        {(["inhale", "hold", "exhale"] as PhaseKey[]).map((p) => (
          <div key={p} className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-500",
                phase === p && isRunning
                  ? p === "inhale" ? "bg-mint-400 scale-150" : p === "hold" ? "bg-blush-400 scale-150" : "bg-breeze-400 scale-150"
                  : "bg-warm-300",
              )}
            />
            <span className="text-[10px] text-warm-400">
              {PHASES[p].duration}s
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
