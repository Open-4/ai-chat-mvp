"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useLocale } from "@/lib/use-locale";

/* ── helpers ── */
function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

/* ═══════════════════════════════════════════
   Multi-language dictionary
   ═══════════════════════════════════════════ */
const t: Record<string, Record<string, string>> = {
  en: {
    greeting: {
      morning: "Good morning",
      afternoon: "Good afternoon",
      evening: "Good evening",
      night: "Good night",
    },
    subtitle: "How are you feeling today?",
    emotions: "Tap to share",
    tools: "Gentle Tools",
    emotionsList: [
      { key: "positive", label: "Happy", emoji: "😊" },
      { key: "calm", label: "Calm", emoji: "😌" },
      { key: "anxious", label: "Anxious", emoji: "😰" },
      { key: "low", label: "Low", emoji: "😢" },
      { key: "irritable", label: "Irritable", emoji: "😤" },
      { key: "confused", label: "Confused", emoji: "😶" },
    ],
    toolsList: [
      { key: "breathe", title: "Breathing", desc: "4-4-6 gentle breath guide", icon: "🌿", href: "/tools" },
      { key: "journal", title: "Journal", desc: "Write down your thoughts", icon: "📝", href: "/journal" },
      { key: "mindful", title: "Mindfulness", desc: "A moment of presence", icon: "🧘", href: "/chat" },
    ],
    nav: {
      chat: "Chat",
      tools: "Tools",
      records: "Records",
      me: "Me",
    },
  },
  es: {
    greeting: {
      morning: "Buenos días",
      afternoon: "Buenas tardes",
      evening: "Buenas noches",
      night: "Buenas noches",
    },
    subtitle: "¿Cómo te sientes hoy?",
    emotions: "Toca para compartir",
    tools: "Herramientas suaves",
    emotionsList: [
      { key: "positive", label: "Feliz", emoji: "😊" },
      { key: "calm", label: "Calma", emoji: "😌" },
      { key: "anxious", label: "Ansioso", emoji: "😰" },
      { key: "low", label: "Bajo", emoji: "😢" },
      { key: "irritable", label: "Irritable", emoji: "😤" },
      { key: "confused", label: "Confuso", emoji: "😶" },
    ],
    toolsList: [
      { key: "breathe", title: "Respiración", desc: "Guía de respiración 4-4-6", icon: "🌿", href: "/tools" },
      { key: "journal", title: "Diario", desc: "Escribe tus pensamientos", icon: "📝", href: "/journal" },
      { key: "mindful", title: "Atención plena", desc: "Un momento de presencia", icon: "🧘", href: "/chat" },
    ],
    nav: {
      chat: "Chat",
      tools: "Herramientas",
      records: "Registros",
      me: "Yo",
    },
  },
  fr: {
    greeting: {
      morning: "Bonjour",
      afternoon: "Bon après-midi",
      evening: "Bonsoir",
      night: "Bonne nuit",
    },
    subtitle: "Comment te sens-tu aujourd'hui ?",
    emotions: "Touche pour partager",
    tools: "Outils doux",
    emotionsList: [
      { key: "positive", label: "Heureux", emoji: "😊" },
      { key: "calm", label: "Calme", emoji: "😌" },
      { key: "anxious", label: "Anxieux", emoji: "😰" },
      { key: "low", label: "Bas", emoji: "😢" },
      { key: "irritable", label: "Irritable", emoji: "😤" },
      { key: "confused", label: "Confus", emoji: "😶" },
    ],
    toolsList: [
      { key: "breathe", title: "Respiration", desc: "Guide de respiration 4-4-6", icon: "🌿", href: "/tools" },
      { key: "journal", title: "Journal", desc: "Écris tes pensées", icon: "📝", href: "/journal" },
      { key: "mindful", title: "Pleine conscience", desc: "Un moment de présence", icon: "🧘", href: "/chat" },
    ],
    nav: {
      chat: "Chat",
      tools: "Outils",
      records: "Registres",
      me: "Moi",
    },
  },
};

/* ═══════════════════════════════════════════
   Emotion card config (colors from design system)
   ═══════════════════════════════════════════ */
const emotionStyles: Record<string, { bg: string; dot: string; ring: string }> = {
  positive:  { bg: "bg-mint-50 dark:bg-mint-950",   dot: "bg-mint-400",   ring: "ring-mint-400/20" },
  calm:      { bg: "bg-breeze-50 dark:bg-breeze-950", dot: "bg-breeze-400", ring: "ring-breeze-400/20" },
  anxious:   { bg: "bg-blush-50 dark:bg-blush-950",  dot: "bg-blush-400",  ring: "ring-blush-400/20" },
  low:       { bg: "bg-warm-100 dark:bg-warm-800",   dot: "bg-warm-400",   ring: "ring-warm-400/20" },
  irritable: { bg: "bg-mint-50 dark:bg-mint-950",    dot: "bg-blush-400",  ring: "ring-blush-400/20" },
  confused:  { bg: "bg-breeze-100 dark:bg-breeze-900", dot: "bg-breeze-500", ring: "ring-breeze-500/20" },
};

/* ═══════════════════════════════════════════
   Time-based greeting
   ═══════════════════════════════════════════ */
function getGreeting(dict: Record<string, string>): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return dict.morning;
  if (h >= 12 && h < 18) return dict.afternoon;
  if (h >= 18 && h < 23) return dict.evening;
  return dict.night;
}

/* ═══════════════════════════════════════════
   Page
   ═══════════════════════════════════════════ */
export default function HomePage() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const dict = t[locale] ?? t.en;
  const greeting = getGreeting(dict.greeting);

  const [greetingVisible, setGreetingVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setGreetingVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  /* ── Navigate to chat with emotion context ── */
  const handleEmotion = (emotionKey: string, emotionLabel: string) => {
    router.push(`/${locale}/chat?emotion=${emotionKey}&label=${encodeURIComponent(emotionLabel)}`);
  };

  /* ── Language switch ── */
  const switchLocale = (next: string) => {
    document.cookie = `locale=${next};path=/;max-age=${86400 * 365}`;
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ═══════════════════════════════════════
          Header: greeting + language switcher
          ═══════════════════════════════════════ */}
      <header
        className={cn(
          "shrink-0 flex items-start justify-between px-5 pt-8 pb-4 md:px-8 md:pt-12",
          "transition-all duration-700 ease-out",
          greetingVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        )}
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
            {greeting} <span className="inline-block animate-[wave_2s_ease-in-out_infinite] origin-[70%_70%]">👋</span>
          </h1>
          <p className="mt-2 text-base text-warm-500 dark:text-warm-400">
            {dict.subtitle}
          </p>
        </div>

        {/* Language switcher */}
        <div className="relative group">
          <button
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-card text-sm font-medium",
              "bg-surface border border-border shadow-soft-sm",
              "hover:bg-muted transition-colors duration-400",
            )}
          >
            <span className="text-base">
              {locale === "en" ? "🇬🇧" : locale === "es" ? "🇪🇸" : "🇫🇷"}
            </span>
            <span className="hidden sm:inline text-warm-600 dark:text-warm-400 uppercase">
              {locale}
            </span>
            <svg className="w-3 h-3 text-warm-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 z-30 hidden group-hover:block">
            <div className="bg-surface border border-border rounded-card shadow-soft-lg py-1 min-w-[120px]">
              {[
                { code: "en", flag: "🇬🇧", label: "English" },
                { code: "es", flag: "🇪🇸", label: "Español" },
                { code: "fr", flag: "🇫🇷", label: "Français" },
              ].map((l) => (
                <button
                  key={l.code}
                  onClick={() => switchLocale(l.code)}
                  className={cn(
                    "w-full text-left px-4 py-2 text-sm flex items-center gap-2",
                    "hover:bg-muted transition-colors duration-300",
                    locale === l.code ? "text-mint-600 dark:text-mint-400 font-medium" : "text-foreground",
                  )}
                >
                  <span>{l.flag}</span>
                  <span>{l.label}</span>
                  {locale === l.code && (
                    <svg className="w-3.5 h-3.5 ml-auto text-mint-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════
          Emotion cards
          ═══════════════════════════════════════ */}
      <section
        className={cn(
          "px-5 md:px-8 pb-6",
          "transition-all duration-700 ease-out delay-150",
          greetingVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        )}
      >
        <p className="text-xs font-medium text-warm-400 uppercase tracking-wide mb-3">
          {dict.emotions}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {dict.emotionsList.map((item: { key: string; label: string; emoji: string }) => {
            const s = emotionStyles[item.key] ?? emotionStyles.positive;
            return (
              <button
                key={item.key}
                onClick={() => handleEmotion(item.key, item.label)}
                className={cn(
                  "relative flex flex-col items-start gap-2 p-4 rounded-card text-left",
                  "border border-transparent ring-1 ring-inset",
                  s.bg, s.ring,
                  "hover:shadow-soft-md hover:scale-[1.02]",
                  "active:scale-[0.98]",
                  "transition-all duration-400 ease-out",
                  "focus-visible:ring-2 focus-visible:ring-mint-400",
                )}
              >
                <span className="text-2xl select-none">{item.emoji}</span>
                <span className="text-sm font-medium text-foreground truncate min-w-0">{item.label}</span>
                <span className={cn("absolute top-3 right-3 w-2 h-2 rounded-full", s.dot)} />
              </button>
            );
          })}
        </div>
      </section>

      {/* ═══════════════════════════════════════
          Tool cards
          ═══════════════════════════════════════ */}
      <section
        className={cn(
          "px-5 md:px-8 pb-24 flex-1",
          "transition-all duration-700 ease-out delay-300",
          greetingVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        )}
      >
        <p className="text-xs font-medium text-warm-400 uppercase tracking-wide mb-3">
          {dict.tools}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {dict.toolsList.map((item: { key: string; title: string; desc: string; icon: string; href: string }) => (
            <Link
              key={item.key}
              href={`/${locale}${item.href}`}
              className={cn(
                "flex items-center gap-4 p-4 rounded-card",
                "bg-surface border border-border shadow-soft-sm",
                "hover:shadow-soft-md hover:border-mint-200 dark:hover:border-mint-800",
                "active:scale-[0.98]",
                "transition-all duration-400 ease-out",
                "group",
              )}
            >
              <span className="text-2xl select-none shrink-0 group-hover:scale-110 transition-transform duration-400">
                {item.icon}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-warm-500 dark:text-warm-400 truncate">{item.desc}</p>
              </div>
              <svg className="w-4 h-4 text-warm-300 shrink-0 ml-auto group-hover:translate-x-1 transition-transform duration-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════
          Bottom nav
          ═══════════════════════════════════════ */}
      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 z-20",
          "bg-surface/80 backdrop-blur-xl border-t border-border",
          "safe-area-bottom",
        )}
      >
        <div className="flex items-center justify-around max-w-lg mx-auto h-16 px-2">
          {[
            { key: "chat", icon: ChatIcon, href: `/${locale}/chat` },
            { key: "tools", icon: ToolsIcon, href: `/${locale}/tools` },
            { key: "records", icon: RecordsIcon, href: `/${locale}/history` },
            { key: "me", icon: MeIcon, href: `/${locale}/profile` },
          ].map(({ key, icon: Icon, href }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={key}
                href={href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-card min-w-0",
                  "text-warm-400 hover:text-foreground",
                  "hover:bg-muted",
                  "transition-all duration-400 ease-out",
                  isActive ? "text-mint-600 dark:text-mint-400" : "",
                )}
              >
                <Icon active={isActive} />
                <span className="text-[10px] font-medium">
                  {(dict.nav as Record<string, string>)[key] ?? key}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* CSS animations */}
      <style jsx>{`
        @keyframes wave {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(14deg); }
          50% { transform: rotate(-8deg); }
          75% { transform: rotate(14deg); }
        }
        .safe-area-bottom {
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Nav icons (inline SVG)
   ═══════════════════════════════════════════ */

function ChatIcon({ active }: { active?: boolean }) {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ToolsIcon({ active }: { active?: boolean }) {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

function RecordsIcon({ active }: { active?: boolean }) {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function MeIcon({ active }: { active?: boolean }) {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
