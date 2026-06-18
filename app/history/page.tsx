"use client";

import { useState, useEffect, useMemo } from "react";
import { useLocale } from "@/lib/use-locale";
import Link from "next/link";
import {
  getJournalEntriesByMonth,
  getUserConversations,
  getConversation,
  type JournalEntry,
  type ConversationListItem,
  type ConversationData,
} from "@/lib/kv";

/* ── helpers ── */
function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

/* ═══════════════════════════════════════════
   Dictionary
   ═══════════════════════════════════════════ */
const t: Record<string, Record<string, string>> = {
  en: {
    title: "Mood History",
    subtitle: "Your emotional journey",
    emptyChart: "No mood data this month",
    emptyTimeline: "Start journaling to see your history",
    conversation: "Conversation",
    journal: "Journal",
    noEmotion: "No emotion data",
    months: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdays: ["Su","Mo","Tu","We","Th","Fr","Sa"],
  },
  es: {
    title: "Historial de ánimo",
    subtitle: "Tu viaje emocional",
    emptyChart: "Sin datos este mes",
    emptyTimeline: "Empieza tu diario para ver el historial",
    conversation: "Conversación",
    journal: "Diario",
    noEmotion: "Sin datos de emoción",
    months: ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"],
    weekdays: ["Do","Lu","Ma","Mi","Ju","Vi","Sa"],
  },
  fr: {
    title: "Historique d'humeur",
    subtitle: "Ton voyage émotionnel",
    emptyChart: "Pas de données ce mois",
    emptyTimeline: "Commence ton journal pour voir l'historique",
    conversation: "Conversation",
    journal: "Journal",
    noEmotion: "Pas de données",
    months: ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Aoû","Sep","Oct","Nov","Déc"],
    weekdays: ["Di","Lu","Ma","Me","Je","Ve","Sa"],
  },
};

/* ═══════════════════════════════════════════
   Emotion config (same as journal page)
   ═══════════════════════════════════════════ */
const emotionScore: Record<string, number> = {
  positive: 5, calm: 4, confused: 3, anxious: 2, irritable: 1, low: 0,
};
const Y_LABELS = ["Low","Irritable","Anxious","Confused","Calm","Happy"];
const emotionColor: Record<string, string> = {
  positive: "#65c3a9", calm: "#aed6f1", confused: "#bfb4a8",
  anxious: "#f5b7b1", irritable: "#d99b95", low: "#a3998e",
};
const emotionDot: Record<string, string> = {
  positive:"bg-mint-400", calm:"bg-breeze-400", confused:"bg-warm-400",
  anxious:"bg-blush-400", irritable:"bg-blush-300", low:"bg-warm-500",
};
const emotionBg: Record<string, string> = {
  positive:"bg-mint-50 dark:bg-mint-950", calm:"bg-breeze-50 dark:bg-breeze-950",
  confused:"bg-warm-100 dark:bg-warm-800", anxious:"bg-blush-50 dark:bg-blush-950",
  irritable:"bg-warm-50 dark:bg-warm-900", low:"bg-warm-100 dark:bg-warm-800",
};

const DEMO_USER = "demo-user-001";

/* ═══════════════════════════════════════════
   Smooth SVG path helper
   ═══════════════════════════════════════════ */
function smoothPath(
  pts: { x: number; y: number }[],
): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) {
    return `M ${pts[0].x} ${pts[0].y} L ${pts[0].x} ${pts[0].y}`;
  }
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const c = pts[i];
    const n = pts[i + 1];
    const cx = (c.x + n.x) / 2;
    d += ` C ${cx} ${c.y}, ${cx} ${n.y}, ${n.x} ${n.y}`;
  }
  return d;
}

/* ═══════════════════════════════════════════
   Mood Chart (inline SVG)
   ═══════════════════════════════════════════ */
function MoodChart({
  data,
  dict,
}: {
  data: { date: string; emotion: string }[];
  dict: Record<string, string>;
}) {
  const W = 320;
  const H = 180;
  const PAD_L = 28;
  const PAD_R = 8;
  const PAD_T = 12;
  const PAD_B = 22;
  const PW = W - PAD_L - PAD_R;
  const PH = H - PAD_T - PAD_B;

  const daysInMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    0,
  ).getDate();

  /* aggregate: date → max score */
  const map = new Map<number, number>();
  for (const d of data) {
    const day = parseInt(d.date.split("-")[2], 10);
    const score = emotionScore[d.emotion] ?? -1;
    if (score < 0) continue;
    map.set(day, Math.max(map.get(day) ?? -1, score));
  }

  const points: { x: number; y: number; day: number; score: number }[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const score = map.get(day);
    if (score === undefined) continue;
    const x = PAD_L + ((day - 1) / (daysInMonth - 1 || 1)) * PW;
    const y = PAD_T + PH - (score / 5) * PH;
    points.push({ x, y, day, score });
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-[640px] h-auto mx-auto"
        role="img"
        aria-label="Mood chart"
      >
        {/* gradient defs */}
        <defs>
          <linearGradient id="moodGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#65c3a9" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#65c3a9" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* grid lines */}
        {Y_LABELS.map((_, i) => {
          const gy = PAD_T + PH - (i / 5) * PH;
          return (
            <line
              key={i}
              x1={PAD_L} y1={gy} x2={W - PAD_R} y2={gy}
              stroke="hsl(35,5%,85%)"
              strokeWidth={0.5}
              strokeDasharray="3 3"
            />
          );
        })}

        {/* Y labels */}
        {Y_LABELS.map((label, i) => {
          const gy = PAD_T + PH - (i / 5) * PH;
          return (
            <text
              key={i}
              x={PAD_L - 4}
              y={gy + 3}
              textAnchor="end"
              className="fill-warm-400"
              style={{ fontSize: "6px" }}
            >
              {label}
            </text>
          );
        })}

        {points.length >= 2 && (
          <>
            {/* gradient fill */}
            <path
              d={`${smoothPath(points)} L ${points[points.length - 1].x} ${PAD_T + PH} L ${points[0].x} ${PAD_T + PH} Z`}
              fill="url(#moodGrad)"
            />
            {/* smooth line */}
            <path
              d={smoothPath(points)}
              fill="none"
              stroke="#65c3a9"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}

        {/* dots */}
        {points.map((p) => (
          <circle
            key={p.day}
            cx={p.x}
            cy={p.y}
            r={3}
            fill={emotionColor[Y_LABELS[p.score].toLowerCase()] ?? "#65c3a9"}
            stroke="white"
            strokeWidth={1.5}
          />
        ))}

        {/* X labels (every ~5 days) */}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1)
          .filter((d) => d === 1 || d === daysInMonth || d % 5 === 0)
          .map((day) => {
            const x = PAD_L + ((day - 1) / (daysInMonth - 1 || 1)) * PW;
            return (
              <text
                key={day}
                x={x}
                y={H - 4}
                textAnchor="middle"
                className="fill-warm-400"
                style={{ fontSize: "6px" }}
              >
                {day}
              </text>
            );
          })}

        {/* empty state */}
        {points.length === 0 && (
          <text
            x={W / 2}
            y={H / 2}
            textAnchor="middle"
            className="fill-warm-400"
            style={{ fontSize: "9px" }}
          >
            {dict.emptyChart}
          </text>
        )}
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Timeline item
   ═══════════════════════════════════════════ */
function TimelineItem({
  type,
  title,
  content,
  emotion,
  time,
  isExpanded,
  onToggle,
  dict,
}: {
  type: "journal" | "conversation";
  title: string;
  content: string;
  emotion?: string;
  time: string;
  isExpanded: boolean;
  onToggle: () => void;
  dict: Record<string, string>;
}) {
  const isJournal = type === "journal";
  const dot = emotion ? emotionDot[emotion] ?? "bg-warm-400" : "bg-warm-300";
  const bg = emotion ? emotionBg[emotion] ?? "" : "";

  return (
    <div
      className={cn(
        "relative pl-6 pb-4 border-l-2 border-warm-200 dark:border-warm-700 last:border-transparent",
        "cursor-pointer group",
      )}
      onClick={onToggle}
    >
      {/* timeline dot */}
      <span
        className={cn(
          "absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full border-2 border-background",
          dot,
        )}
      />

      <div
        className={cn(
          "p-3 rounded-card border transition-all duration-400",
          "hover:shadow-soft-md",
          isExpanded
            ? `${bg} border-transparent shadow-soft-sm`
            : "border-border bg-surface",
        )}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-medium text-warm-400 uppercase tracking-wide">
            {isJournal ? dict.journal : dict.conversation}
          </span>
          <span className="text-[10px] text-warm-400">{time}</span>
          {emotion && (
            <span className={cn("ml-auto w-1.5 h-1.5 rounded-full", dot)} />
          )}
        </div>

        <p className="text-sm font-medium text-foreground leading-snug">
          {isExpanded ? title : title.length > 40 ? title.slice(0, 40) + "…" : title}
        </p>

        {isExpanded && (
          <p className="mt-2 text-sm text-warm-600 dark:text-warm-300 leading-relaxed whitespace-pre-wrap">
            {content || dict.noEmotion}
          </p>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Page
   ═══════════════════════════════════════════ */
export default function HistoryPage() {
  const locale = useLocale();
  const dict = t[locale] ?? t.en;

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [convDetails, setConvDetails] = useState<Map<string, ConversationData>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const yearMonth = `${year}-${String(month).padStart(2, "0")}`;

  /* ── load data ── */
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    async function load() {
      try {
        const [entries, convs] = await Promise.all([
          getJournalEntriesByMonth(DEMO_USER, yearMonth),
          getUserConversations(DEMO_USER),
        ]);
        if (cancelled) return;
        setJournalEntries(entries);
        setConversations(convs);
        setConvDetails(new Map()); // reset details
      } catch (err) {
        console.error("[history] Load error:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [yearMonth]);

  /* ── chart data ── */
  const chartData = useMemo(
    () =>
      journalEntries.map((e) => ({
        date: e.date,
        emotion: e.emotion,
      })),
    [journalEntries],
  );

  /* ── timeline: merge journals + conversations by date ── */
  const timeline = useMemo(() => {
    const groups = new Map<
      string,
      {
        type: "journal" | "conversation";
        id: string;
        title: string;
        content: string;
        emotion?: string;
        time: string;
        date: string;
      }[]
    >();

    /* journal entries */
    for (const e of journalEntries) {
      const list = groups.get(e.date) ?? [];
      list.push({
        type: "journal",
        id: e.id,
        title: e.content.slice(0, 50),
        content: e.content,
        emotion: e.emotion,
        time: new Date(e.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        date: e.date,
      });
      groups.set(e.date, list);
    }

    /* conversations */
    for (const c of conversations) {
      const date = c.updatedAt.slice(0, 10);
      const list = groups.get(date) ?? [];
      const detail = convDetails.get(c.id);
      list.push({
        type: "conversation",
        id: c.id,
        title: c.title,
        content: detail?.messages.map((m) => m.content).join("\n") ?? c.lastMessage,
        emotion: detail?.messages.find((m) => m.emotion)?.emotion?.type,
        time: new Date(c.updatedAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        date,
      });
      groups.set(date, list);
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, items]) => ({
        date,
        items: items.sort(
          (a, b) => b.time.localeCompare(a.time),
        ),
      }));
  }, [journalEntries, conversations, convDetails]);

  /* ── expand & load conversation detail ── */
  const toggleExpand = async (id: string, type: "journal" | "conversation") => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

    /* lazy-load conversation detail */
    if (type === "conversation" && !convDetails.has(id) && !expanded.has(id)) {
      try {
        const data = await getConversation(DEMO_USER, id);
        if (data) {
          setConvDetails((prev) => new Map(prev).set(id, data));
        }
      } catch (err) {
        console.error("[history] Failed to load conversation:", err);
      }
    }
  };

  /* ── month nav ── */
  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    const canAdvance = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
    if (!canAdvance) return;
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="flex items-center gap-4 px-5 pt-8 pb-2 md:px-8">
        <Link
          href={`/${locale}`}
          className="text-warm-400 hover:text-foreground transition-colors duration-400 p-1"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">{dict.title}</h1>
          <p className="text-xs text-warm-400">{dict.subtitle}</p>
        </div>
      </header>

      {/* ── Month selector ── */}
      <div className="flex items-center justify-center gap-3 px-5 py-4 md:px-8">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-full text-warm-400 hover:text-foreground hover:bg-muted transition-colors duration-400"
          aria-label="Previous month"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-base font-medium text-foreground min-w-[120px] text-center">
          {dict.months[month - 1]} {year}
        </span>
        <button
          onClick={nextMonth}
          disabled={
            year === now.getFullYear() && month === now.getMonth() + 1
          }
          className="p-1.5 rounded-full text-warm-400 hover:text-foreground hover:bg-muted transition-colors duration-400 disabled:opacity-30"
          aria-label="Next month"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* ═══ Mood chart ═══ */}
      <section className="px-5 md:px-8 pb-6">
        <div className="max-w-2xl mx-auto bg-surface border border-border rounded-card shadow-soft-sm p-4">
          {isLoading ? (
            <div className="animate-pulse bg-muted rounded h-[180px]" />
          ) : (
            <MoodChart data={chartData} dict={dict} />
          )}
        </div>
      </section>

      {/* ═══ Timeline ═══ */}
      <section className="px-5 md:px-8 pb-24">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-mint-400" />
            {dict.months[month - 1]} {year}
          </h2>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse bg-muted rounded-card h-16" />
              ))}
            </div>
          ) : timeline.length === 0 ? (
            <div className="text-center py-16">
              <span className="text-4xl">📊</span>
              <p className="text-sm text-warm-400 mt-3">{dict.emptyTimeline}</p>
            </div>
          ) : (
            <div>
              {timeline.map(({ date, items }) => (
                <div key={date} className="mb-6">
                  {/* date header */}
                  <p className="text-xs font-medium text-warm-500 mb-2 sticky top-0 bg-background py-1">
                    {dict.weekdays[new Date(date).getDay()]},{" "}
                    {dict.months[new Date(date).getMonth()]}{" "}
                    {new Date(date).getDate()}
                  </p>

                  {/* items */}
                  {items.map((item) => (
                    <TimelineItem
                      key={item.id}
                      type={item.type}
                      title={item.title}
                      content={item.content}
                      emotion={item.emotion}
                      time={item.time}
                      isExpanded={expanded.has(item.id)}
                      onToggle={() => toggleExpand(item.id, item.type)}
                      dict={dict}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
