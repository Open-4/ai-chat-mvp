"use client";

import { useState, useEffect, useRef } from "react";
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
    save: "Save 20%",
    free: "Free",
    pro: "Pro",
    recommended: "Recommended",
    month: "/mo",
    year: "/yr",
    freePrice: "$0",
    proMonthly: "$9.90",
    proYearly: "$95.90",
    ctaFree: "Get Started Free",
    ctaPro: "Upgrade with PayPal",
    paypalLoading: "Loading PayPal…",
    processing: "Completing payment…",
    success: "Payment successful! You're now Pro 💚",
    errorPaypal: "PayPal SDK failed to load. Please refresh.",
    errorPayment: "Payment failed. Please try again.",
    features: {
      chat: "AI companion chat",
      journal: "Emotion journal",
      breathe: "Breathing exercises",
      history: "Mood history",
      unlimited: "Unlimited daily messages",
      priority: "Priority AI response",
      early: "Early access to new tools",
      custom: "Custom emotion insights",
    },
    back: "Back",
  },
  es: {
    title: "Precios simples y suaves",
    subtitle: "Empieza gratis. Mejora cuando estés listo.",
    monthly: "Mensual",
    yearly: "Anual",
    save: "Ahorra 20%",
    free: "Gratis",
    pro: "Pro",
    recommended: "Recomendado",
    month: "/mes",
    year: "/año",
    freePrice: "$0",
    proMonthly: "$9.90",
    proYearly: "$95.90",
    ctaFree: "Empezar gratis",
    ctaPro: "Actualizar con PayPal",
    paypalLoading: "Cargando PayPal…",
    processing: "Completando pago…",
    success: "¡Pago exitoso! Ahora eres Pro 💚",
    errorPaypal: "PayPal SDK no cargó. Refresca la página.",
    errorPayment: "Pago fallido. Intenta de nuevo.",
    features: {
      chat: "Chat con compañero IA",
      journal: "Diario de emociones",
      breathe: "Ejercicios de respiración",
      history: "Historial de ánimo",
      unlimited: "Mensajes diarios ilimitados",
      priority: "Respuesta prioritaria",
      early: "Acceso anticipado",
      custom: "Informes emocionales",
    },
    back: "Volver",
  },
  fr: {
    title: "Des prix simples et doux",
    subtitle: "Commence gratuitement. Passe Pro quand tu es prêt.",
    monthly: "Mensuel",
    yearly: "Annuel",
    save: "Économise 20%",
    free: "Gratuit",
    pro: "Pro",
    recommended: "Recommandé",
    month: "/mois",
    year: "/an",
    freePrice: "$0",
    proMonthly: "$9.90",
    proYearly: "$95.90",
    ctaFree: "Commencer gratuitement",
    ctaPro: "Passer Pro avec PayPal",
    paypalLoading: "Chargement de PayPal…",
    processing: "Paiement en cours…",
    success: "Paiement réussi ! Tu es maintenant Pro 💚",
    errorPaypal: "PayPal SDK n'a pas chargé. Rafraîchis.",
    errorPayment: "Paiement échoué. Réessaie.",
    features: {
      chat: "Chat avec compagnon IA",
      journal: "Journal d'émotions",
      breathe: "Exercices de respiration",
      history: "Historique d'humeur",
      unlimited: "Messages quotidiens illimités",
      priority: "Réponse prioritaire",
      early: "Accès anticipé",
      custom: "Aperçus émotionnels",
    },
    back: "Retour",
  },
};

/* ═══════════════════════════════════════════
   Plan config
   ═══════════════════════════════════════════ */
const freeFeatures = ["chat", "journal", "breathe", "history"] as const;
const proFeatures = [...freeFeatures, "unlimited", "priority", "early", "custom"] as const;

const DEMO_USER = "demo-user-001";

/* PayPal SDK type (minimal) */
declare global {
  interface Window {
    paypal?: {
      Buttons: (options: {
        style?: Record<string, string>;
        createOrder: () => Promise<string>;
        onApprove: (data: { orderID: string }) => Promise<void>;
        onError: (err: Error) => void;
        onCancel: () => void;
      }) => { render: (el: string) => void; close: () => void };
    };
  }
}

/* ═══════════════════════════════════════════
   Page
   ═══════════════════════════════════════════ */
export default function PricingPage() {
  const { locale } = useParams<{ locale: string }>();
  const dict = t[locale] ?? t.en;
  const features = dict.features as Record<string, string>;

  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [sdkReady, setSdkReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buttonRef = useRef<HTMLDivElement>(null);
  const paypalInstance = useRef<{ close: () => void } | null>(null);

  /* ── Load PayPal JS SDK ── */
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    if (!clientId) {
      setError("NEXT_PUBLIC_PAYPAL_CLIENT_ID not configured");
      return;
    }

    /* avoid duplicate script */
    if (document.querySelector('script[src*="paypal.com/sdk"]')) {
      if (window.paypal) setSdkReady(true);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=capture`;
    script.async = true;
    script.onload = () => setSdkReady(true);
    script.onerror = () => setError(dict.errorPaypal);
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [dict.errorPaypal]);

  /* ── Render PayPal button ── */
  useEffect(() => {
    if (!sdkReady || !window.paypal || !buttonRef.current) return;
    if (paypalInstance.current) {
      paypalInstance.current.close();
    }

    /* clear container */
    buttonRef.current.innerHTML = "";

    const instance = window.paypal.Buttons({
      style: {
        shape: "pill",
        color: "white",
        layout: "vertical",
        label: "subscribe",
        tagline: false,
      },

      createOrder: async () => {
        setError(null);

        const res = await fetch("/api/paypal/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: DEMO_USER, billing, locale }),
        });

        const data = await res.json();
        if (!res.ok || !data.orderId) {
          throw new Error(data.error ?? "Failed to create order");
        }

        return data.orderId as string;
      },

      onApprove: async (data: { orderID: string }) => {
        setIsProcessing(true);
        setError(null);

        try {
          const res = await fetch("/api/paypal/capture-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: data.orderID,
              userId: DEMO_USER,
            }),
          });

          const result = await res.json();
          if (!res.ok) {
            throw new Error(result.error ?? "Capture failed");
          }

          setSuccess(true);
          setIsProcessing(false);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : dict.errorPayment,
          );
          setIsProcessing(false);
        }
      },

      onError: (err: Error) => {
        console.error("[paypal] Button error:", err);
        setError(err.message ?? dict.errorPayment);
      },

      onCancel: () => {
        console.log("[paypal] Payment cancelled by user");
      },
    });

    instance.render("#paypal-button-container");
    paypalInstance.current = instance;

    return () => {
      instance.close();
    };
  }, [sdkReady, billing, locale, dict]);

  const proPrice = billing === "monthly" ? dict.proMonthly : dict.proYearly;

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
                    ["unlimited", "priority", "early", "custom"].includes(k)
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

            {/* ── PayPal button area ── */}
            {success ? (
              <div className="w-full px-5 py-3 rounded-card bg-mint-50 dark:bg-mint-950 text-mint-700 dark:text-mint-300 text-sm font-medium text-center">
                {dict.success}
              </div>
            ) : !sdkReady ? (
              <div className="w-full px-5 py-3 rounded-card bg-muted text-warm-400 text-sm text-center animate-pulse">
                {dict.paypalLoading}
              </div>
            ) : isProcessing ? (
              <div className="w-full px-5 py-3 rounded-card bg-muted text-warm-500 text-sm text-center flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-70" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {dict.processing}
              </div>
            ) : (
              <div
                id="paypal-button-container"
                ref={buttonRef}
                className="w-full min-h-[40px]"
              />
            )}
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
