"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

/* ── helpers ── */
function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

/* ═══════════════════════════════════════════
   Dictionary
   ═══════════════════════════════════════════ */
const t: Record<string, Record<string, string>> = {
  en: {
    title: "Simple, gentle pricing",
    subtitle: "Start free. Upgrade when you're ready.",
    monthly: "Monthly",
    yearly: "Yearly",
    save: "Save 33%",
    free: "Free",
    pro: "Pro",
    recommended: "Recommended",
    month: "/mo",
    year: "/yr",
    freePrice: "$0",
    proMonthly: "$9.99",
    proYearly: "$79.99",
    ctaFree: "Get Started",
    ctaPro: "Start Free Trial",
    processing: "Redirecting…",
    features: {
      chat: "AI companion chat",
      journal: "Emotion journal",
      breathe: "Breathing exercises",
      history: "Mood history",
      unlimited: "Unlimited messages",
      priority: "Priority response",
      early: "Early access to new tools",
      custom: "Custom emotion insights",
    },
    back: "Back",
    error: "Payment service unavailable. Please try later.",
  },
  es: {
    title: "Precios simples y suaves",
    subtitle: "Empieza gratis. Mejora cuando estés listo.",
    monthly: "Mensual",
    yearly: "Anual",
    save: "Ahorra 33%",
    free: "Gratis",
    pro: "Pro",
    recommended: "Recomendado",
    month: "/mes",
    year: "/año",
    freePrice: "$0",
    proMonthly: "$9.99",
    proYearly: "$79.99",
    ctaFree: "Empezar",
    ctaPro: "Prueba gratis",
    processing: "Redirigiendo…",
    features: {
      chat: "Chat con compañero IA",
      journal: "Diario de emociones",
      breathe: "Ejercicios de respiración",
      history: "Historial de ánimo",
      unlimited: "Mensajes ilimitados",
      priority: "Respuesta prioritaria",
      early: "Acceso anticipado a nuevas herramientas",
      custom: "Informes emocionales personalizados",
    },
    back: "Volver",
    error: "Servicio de pago no disponible. Intenta más tarde.",
  },
  fr: {
    title: "Des prix simples et doux",
    subtitle: "Commence gratuitement. Passe à la version supérieure quand tu es prêt.",
    monthly: "Mensuel",
    yearly: "Annuel",
    save: "Économise 33%",
    free: "Gratuit",
    pro: "Pro",
    recommended: "Recommandé",
    month: "/mois",
    year: "/an",
    freePrice: "$0",
    proMonthly: "$9.99",
    proYearly: "$79.99",
    ctaFree: "Commencer",
    ctaPro: "Essai gratuit",
    processing: "Redirection…",
    features: {
      chat: "Chat avec compagnon IA",
      journal: "Journal d'émotions",
      breathe: "Exercices de respiration",
      history: "Historique d'humeur",
      unlimited: "Messages illimités",
      priority: "Réponse prioritaire",
      early: "Accès anticipé aux nouveaux outils",
      custom: "Aperçus émotionnels personnalisés",
    },
    back: "Retour",
    error: "Service de paiement indisponible. Réessaie plus tard.",
  },
};

/* ═══════════════════════════════════════════
   Plan definitions
   ═══════════════════════════════════════════ */
const freeFeatures = ["chat", "journal", "breathe", "history"] as const;
const proFeatures = [
  ...freeFeatures,
  "unlimited",
  "priority",
  "early",
  "custom",
] as const;

const DEMO_USER = "demo-user-001";

/* ═══════════════════════════════════════════
   Page
   ═══════════════════════════════════════════ */
export default function PricingPage() {
  const { locale } = useParams<{ locale: string }>();
  const dict = t[locale] ?? t.en;
  const features = dict.features as Record<string, string>;

  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Stripe checkout ── */
  const handleCheckout = async () => {
    setIsRedirecting(true);
    setError(null);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: DEMO_USER,
          billing,
          locale,
          successUrl: `${window.location.origin}/${locale}/chat`,
          cancelUrl: `${window.location.origin}/${locale}/pricing`,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Failed to create session");
      }

      window.location.href = data.url;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : dict.error,
      );
      setIsRedirecting(false);
    }
  };

  const proPrice =
    billing === "monthly" ? dict.proMonthly : dict.proYearly;

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
      </header>

      {/* ── Title ── */}
      <div className="text-center px-5 pt-6 pb-8 md:pt-10 md:pb-12">
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
          {dict.title}
        </h1>
        <p className="mt-2 text-warm-500">{dict.subtitle}</p>
      </div>

      {/* ── Billing toggle ── */}
      <div className="flex justify-center pb-8">
        <div className="inline-flex items-center bg-muted rounded-card p-1 gap-1">
          <button
            onClick={() => setBilling("monthly")}
            className={cn(
              "px-5 py-2 rounded-card text-sm font-medium transition-all duration-300",
              billing === "monthly"
                ? "bg-surface text-foreground shadow-soft-sm"
                : "text-warm-500 hover:text-foreground",
            )}
          >
            {dict.monthly}
          </button>
          <button
            onClick={() => setBilling("yearly")}
            className={cn(
              "px-5 py-2 rounded-card text-sm font-medium transition-all duration-300 flex items-center gap-2",
              billing === "yearly"
                ? "bg-surface text-foreground shadow-soft-sm"
                : "text-warm-500 hover:text-foreground",
            )}
          >
            {dict.yearly}
            <span className="text-[10px] text-mint-600 dark:text-mint-400 font-medium bg-mint-50 dark:bg-mint-950 px-1.5 py-0.5 rounded-full">
              {dict.save}
            </span>
          </button>
        </div>
      </div>

      {/* ═══ Plan cards ═══ */}
      <div className="px-5 md:px-8 pb-24 max-w-3xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
          {/* ── Free ── */}
          <div
            className={cn(
              "p-6 rounded-card border border-border bg-surface",
              "shadow-soft-sm",
              "transition-all duration-400",
            )}
          >
            <p className="text-lg font-semibold text-foreground mb-1">{dict.free}</p>
            <div className="flex items-baseline gap-0.5 mb-5">
              <span className="text-3xl font-bold text-foreground">{dict.freePrice}</span>
              <span className="text-sm text-warm-400">{dict.month}</span>
            </div>

            <ul className="space-y-2.5 mb-6">
              {freeFeatures.map((k) => (
                <li key={k} className="flex items-start gap-2.5 text-sm text-warm-600 dark:text-warm-300">
                  <svg className="w-4 h-4 text-mint-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {features[k]}
                </li>
              ))}
            </ul>

            <Link
              href={`/${locale}/chat`}
              className={cn(
                "block w-full text-center px-5 py-3 rounded-card text-sm font-medium",
                "border-2 border-mint-300 dark:border-mint-700",
                "text-mint-700 dark:text-mint-300",
                "hover:bg-mint-50 dark:hover:bg-mint-950",
                "transition-all duration-400",
              )}
            >
              {dict.ctaFree}
            </Link>
          </div>

          {/* ── Pro ── */}
          <div
            className={cn(
              "relative p-6 rounded-card border-2 border-mint-400",
              "bg-surface shadow-soft-lg",
              "transition-all duration-400",
              "md:scale-[1.02]",
            )}
          >
            {/* Recommended badge */}
            <span
              className={cn(
                "absolute -top-3 left-1/2 -translate-x-1/2",
                "px-4 py-1 rounded-bubble text-xs font-medium",
                "bg-mint-500 text-white shadow-soft-sm",
              )}
            >
              {dict.recommended}
            </span>

            <p className="text-lg font-semibold text-foreground mb-1 mt-1">{dict.pro}</p>
            <div className="flex items-baseline gap-0.5 mb-5">
              <span className="text-3xl font-bold text-foreground">{proPrice}</span>
              <span className="text-sm text-warm-400">{dict.month}</span>
            </div>

            <ul className="space-y-2.5 mb-6">
              {proFeatures.map((k) => (
                <li
                  key={k}
                  className={cn(
                    "flex items-start gap-2.5 text-sm",
                    k === "unlimited" || k === "priority" || k === "early" || k === "custom"
                      ? "text-foreground font-medium"
                      : "text-warm-600 dark:text-warm-300",
                  )}
                >
                  <svg className="w-4 h-4 text-mint-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {features[k]}
                </li>
              ))}
            </ul>

            <button
              onClick={handleCheckout}
              disabled={isRedirecting}
              className={cn(
                "w-full px-5 py-3 rounded-card text-sm font-medium",
                "bg-mint-500 text-white",
                "hover:bg-mint-600 active:bg-mint-700",
                "shadow-soft-md hover:shadow-soft-lg",
                "transition-all duration-400",
                "active:scale-[0.98]",
                "disabled:opacity-70 disabled:cursor-wait",
                "flex items-center justify-center gap-2",
              )}
            >
              {isRedirecting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-70" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {dict.processing}
                </>
              ) : (
                dict.ctaPro
              )}
            </button>
          </div>
        </div>

        {/* error */}
        {error && (
          <p className="mt-4 text-center text-sm text-blush-600 dark:text-blush-400">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
