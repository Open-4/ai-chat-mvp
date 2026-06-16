"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  saveJournalEntry,
  getJournalEntries,
  type JournalEntry,
} from "@/lib/kv";

/* ── helpers ── */
function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowISO(): string {
  return new Date().toISOString();
}

/* ═══════════════════════════════════════════
   Dictionary
   ═══════════════════════════════════════════ */
const t: Record<string, Record<string, string>> = {
  en: {
    title: "Mood Journal",
    subtitle: "A safe space for your thoughts",
    placeholder: "How are you feeling right now? Write freely...",
    save: "Save Entry",
    saving: "Saving...",
    saved: "Saved 💚",
    todayTitle: "Today's Entries",
    empty: "No entries yet. Write your first one above.",
    emotions: "How are you feeling?",
    back: "Back",
  },
  es: {
    title: "Diario de emociones",
    subtitle: "Un espacio seguro para tus pensamientos",
    placeholder: "¿Cómo te sientes ahora? Escribe libremente...",
    save: "Guardar",
    saving: "Guardando...",
    saved: "Guardado 💚",
    todayTitle: "Entradas de hoy",
    empty: "Aún no hay entradas. Escribe la primera.",
    emotions: "¿Cómo te sientes?",
    back: "Volver",
  },
  fr: {
    title: "Journal d'émotions",
    subtitle: "Un espace sûr pour tes pensées",
    placeholder: "Comment te sens-tu maintenant ? Écris librement...",
    save: "Enregistrer",
    saving: "Enregistrement...",
    saved: "Enregistré 💚",
    todayTitle: "Entrées du jour",
    empty: "Pas encore d'entrée. Écris la première.",
    emotions: "Comment te sens-tu ?",
    back: "Retour",
  },
};

/* ═══════════════════════════════════════════
   Emotion options
   ═══════════════════════════════════════════ */
const emotions = [
  { key: "positive",  emoji: "😊", label: { en: "Happy",   es: "Feliz",    fr: "Heureux" } },
  { key: "calm",      emoji: "😌", label: { en: "Calm",    es: "Calma",    fr: "Calme" } },
  { key: "anxious",   emoji: "😰", label: { en: "Anxious", es: "Ansioso",  fr: "Anxieux" } },
  { key: "low",       emoji: "😢", label: { en: "Low",     es: "Bajo",     fr: "Bas" } },
  { key: "irritable", emoji: "😤", label: { en: "Irritable",es:"Irritable",fr:"Irritable" } },
  { key: "confused",  emoji: "😶", label: { en: "Confused",es:"Confuso",  fr:"Confus" } },
];

const emotionDot: Record<string, string> = {
  positive:  "bg-mint-400",
  calm:      "bg-breeze-400",
  anxious:   "bg-blush-400",
  low:       "bg-warm-400",
  irritable: "bg-blush-300",
  confused:  "bg-breeze-500",
};

const emotionBg: Record<string, string> = {
  positive:  "bg-mint-50 dark:bg-mint-950",
  calm:      "bg-breeze-50 dark:bg-breeze-950",
  anxious:   "bg-blush-50 dark:bg-blush-950",
  low:       "bg-warm-100 dark:bg-warm-800",
  irritable: "bg-warm-50 dark:bg-warm-900",
  confused:  "bg-breeze-100 dark:bg-breeze-900",
};

const DEMO_USER = "demo-user-001";

/* ═══════════════════════════════════════════
   Page
   ═══════════════════════════════════════════ */
export default function JournalPage() {
  const { locale } = useParams<{ locale: string }>();
  const dict = t[locale] ?? t.en;

  /* ── form state ── */
  const [content, setContent] = useState("");
  const [emotion, setEmotion] = useState("calm");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  /* ── entries ── */
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  /* ── load today's entries ── */
  const loadEntries = useCallback(async () => {
    try {
      const list = await getJournalEntries(DEMO_USER, today());
      setEntries(list);
    } catch (err) {
      console.error("[journal] Load error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  /* ── save ── */
  const handleSave = async () => {
    if (!content.trim() || isSaving) return;

    setIsSaving(true);
    setSaved(false);

    const entry: JournalEntry = {
      id: `j-${Date.now()}`,
      userId: DEMO_USER,
      content: content.trim(),
      emotion,
      emotionLabel: emotions.find((e) => e.key === emotion)?.label[locale] ?? emotion,
      date: today(),
      timestamp: nowISO(),
    };

    try {
      await saveJournalEntry(DEMO_USER, entry);
      setContent("");
      setEmotion("calm");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await loadEntries();
    } catch (err) {
      console.error("[journal] Save error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  /* ── format time ── */
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="flex items-center gap-4 px-5 pt-8 pb-4 md:px-8">
        <Link
          href={`/${locale}`}
          className="text-warm-400 hover:text-foreground transition-colors duration-400 p-1"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-foreground">{dict.title}</h1>
          <p className="text-xs text-warm-400">{dict.subtitle}</p>
        </div>
      </header>

      <div className="px-5 md:px-8 max-w-2xl mx-auto pb-24">
        {/* ═══ Input area ═══ */}
        <div className="bg-surface border border-border rounded-card shadow-soft-md p-5 mb-6">
          {/* Emotion selector */}
          <p className="text-xs font-medium text-warm-400 mb-3">{dict.emotions}</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {emotions.map(({ key, emoji, label }) => {
              const l = label as Record<string, string>;
              return (
                <button
                  key={key}
                  onClick={() => setEmotion(key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-bubble text-sm font-medium",
                    "border transition-all duration-300 ease-out",
                    "active:scale-95",
                    emotion === key
                      ? `${emotionBg[key]} border-transparent ring-1 ring-inset ring-current/10`
                      : "border-border text-warm-500 hover:bg-muted",
                  )}
                >
                  <span className="text-base">{emoji}</span>
                  <span>{l[locale] ?? l.en}</span>
                  {emotion === key && (
                    <span className={cn("w-1.5 h-1.5 rounded-full", emotionDot[key])} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Textarea */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={dict.placeholder}
            rows={5}
            className={cn(
              "w-full resize-none bg-muted/50 rounded-bubble px-4 py-3 text-sm",
              "text-foreground placeholder:text-warm-400",
              "border border-border focus:border-mint-400",
              "outline-none transition-colors duration-400",
            )}
          />

          {/* Submit */}
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-warm-400">
              {content.length > 0 ? `${content.length} chars` : ""}
            </span>
            <button
              onClick={handleSave}
              disabled={!content.trim() || isSaving}
              className={cn(
                "px-6 py-2.5 rounded-card text-sm font-medium",
                "bg-mint-500 text-white",
                "hover:bg-mint-600 active:bg-mint-700",
                "disabled:bg-mint-300 dark:disabled:bg-mint-800",
                "shadow-soft-sm hover:shadow-soft-md",
                "transition-all duration-400 ease-out",
                "active:scale-95 disabled:cursor-not-allowed",
                saved && "bg-mint-600",
              )}
            >
              {isSaving ? dict.saving : saved ? dict.saved : dict.save}
            </button>
          </div>
        </div>

        {/* ═══ Today's entries ═══ */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-mint-400" />
            {dict.todayTitle}
            {entries.length > 0 && (
              <span className="text-xs text-warm-400 font-normal">({entries.length})</span>
            )}
          </h2>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse bg-muted rounded-card h-20" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-3xl">📝</span>
              <p className="text-sm text-warm-400 mt-2">{dict.empty}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className={cn(
                    "p-4 rounded-card border border-border",
                    emotionBg[entry.emotion] ?? "bg-surface",
                    "shadow-soft-sm",
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn("w-2 h-2 rounded-full", emotionDot[entry.emotion] ?? "bg-warm-400")} />
                    <span className="text-xs font-medium text-warm-600 dark:text-warm-400">
                      {entry.emotionLabel}
                    </span>
                    <span className="text-[10px] text-warm-400 ml-auto">
                      {fmtTime(entry.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {entry.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
