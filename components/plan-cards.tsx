"use client";

import { useState } from "react";
import Script from "next/script";
import { useCheckout } from "./paywall";
import type { FeatureKey } from "@/lib/features";

/**
 * The plan chooser, shared by the paywall and the upgrade page.
 *
 * Everything shown here is generated from the plans in the database, so a price
 * or a feature edited in the admin changes what customers are offered without a
 * deploy. The feature list is deliberately shown in full on every card — a tick
 * and a dash in the same place on both is easier to compare than two different
 * lists of only-what-you-get.
 */

export type PublicPlan = {
  key: string;
  name: string;
  tagline: string;
  priceMinor: number;
  /** The struck-through "was" price. Display only, never charged. */
  anchorMinor?: number | null;
  currency: string;
  features: FeatureKey[];
};

export type FeatureLabel = { key: FeatureKey; name: string };

export const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function money(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}

export function PlanCards({
  plans,
  features,
  user,
  mode,
  /** Which features the visitor already has, so their own plan reads as current. */
  currentPlanKey,
  /** The feature that sent them here, highlighted so the reason is obvious. */
  highlight,
}: {
  plans: PublicPlan[];
  features: FeatureLabel[];
  user: { name: string; email: string };
  mode: "subscription" | "one-off";
  currentPlanKey?: string;
  highlight?: FeatureKey | null;
}) {
  const { start, busy, error } = useCheckout(user, mode);

  // an applied code: server-verified prices per plan, never client math
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promo, setPromo] = useState<{
    code: string;
    discounts: Record<string, { amountMinor: number; percentOff: number }>;
  } | null>(null);

  const applyPromo = async () => {
    const code = promoInput.trim();
    if (!code || promoBusy) return;
    setPromoBusy(true);
    setPromoError(null);
    try {
      const res = await fetch("/api/billing/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json()) as {
        code?: string;
        discounts?: Record<string, { amountMinor: number; percentOff: number }>;
        error?: string;
      };
      if (!res.ok || !data.code || !data.discounts) {
        throw new Error(data.error ?? "That code isn't valid right now");
      }
      setPromo({ code: data.code, discounts: data.discounts });
    } catch (err) {
      setPromoError(err instanceof Error ? err.message : "That code isn't valid right now");
    }
    setPromoBusy(false);
  };

  if (plans.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line px-6 py-10 text-center text-sm text-ink-soft">
        No plans are on sale right now. Please check back shortly.
      </p>
    );
  }

  // the dearest plan is the one to nudge toward, and the only one worth a badge
  const best = plans.reduce((a, b) => (b.priceMinor > a.priceMinor ? b : a));

  return (
    <>
      <Script src={CHECKOUT_SRC} strategy="afterInteractive" />

      <div className={`grid gap-3 ${plans.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {plans.map((plan) => {
          const current = plan.key === currentPlanKey;
          const featured = plan.key === best.key && plans.length > 1;
          return (
            <div
              key={plan.key}
              className={`relative flex flex-col rounded-2xl border bg-card p-5 text-left ${
                featured ? "border-sun shadow-lg shadow-sun/10" : "border-line"
              }`}
            >
              {featured && (
                <span className="absolute -top-2.5 left-5 rounded-full bg-sun px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-on-accent">
                  Everything
                </span>
              )}

              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">{plan.name}</span>
                {current && (
                  <span className="rounded-full bg-paper-deep px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                    Your plan
                  </span>
                )}
              </div>

              <div className="mt-1.5 flex items-baseline gap-1.5">
                {promo?.discounts[plan.key] ? (
                  <>
                    <span className="text-sm font-medium text-ink-faint line-through decoration-ink-faint/60">
                      {money(plan.priceMinor, plan.currency)}
                    </span>
                    <span className="font-display text-3xl tracking-tight text-sun-deep">
                      {money(promo.discounts[plan.key].amountMinor, plan.currency)}
                    </span>
                  </>
                ) : (
                  <>
                    {plan.anchorMinor ? (
                      <span className="text-sm font-medium text-ink-faint line-through decoration-ink-faint/60">
                        {money(plan.anchorMinor, plan.currency)}
                      </span>
                    ) : null}
                    <span className="font-display text-3xl tracking-tight">
                      {money(plan.priceMinor, plan.currency)}
                    </span>
                  </>
                )}
                <span className="text-xs text-ink-faint">/ month</span>
              </div>
              {promo?.discounts[plan.key] && (
                <p className="mt-1 text-[11px] font-semibold text-sun-deep">
                  Code {promo.code} applied, {promo.discounts[plan.key].percentOff}% off
                </p>
              )}

              {plan.tagline && (
                <p className="mt-1.5 text-[13px] leading-5 text-ink-soft">{plan.tagline}</p>
              )}

              <ul className="mt-4 flex-1 space-y-1.5">
                {features.map((f) => {
                  const on = plan.features.includes(f.key);
                  const flagged = highlight === f.key;
                  return (
                    <li
                      key={f.key}
                      className={`flex items-start gap-2 text-[13px] leading-5 ${
                        on ? "text-ink-soft" : "text-ink-faint"
                      } ${flagged ? "font-semibold" : ""}`}
                    >
                      <span
                        className={`mt-px shrink-0 ${on ? "text-moss" : "text-ink-faint/70"}`}
                        aria-hidden
                      >
                        {on ? "✓" : ""}
                      </span>
                      <span className={on ? "" : "line-through decoration-ink-faint/40"}>
                        {f.name}
                      </span>
                    </li>
                  );
                })}
                <li className="flex items-start gap-2 text-[13px] leading-5 text-ink-soft">
                  <span className="mt-px shrink-0 text-moss" aria-hidden>
                    ✓
                  </span>
                  <span>Everything else Kairo does</span>
                </li>
              </ul>

              <button
                onClick={() => start(plan.key, promo?.discounts[plan.key] ? promo.code : undefined)}
                disabled={Boolean(busy)}
                className={`mt-5 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-transform active:scale-[0.99] disabled:opacity-60 ${
                  featured
                    ? "bg-sun text-on-accent shadow-lg shadow-sun/25"
                    : "border border-line bg-paper text-ink hover:border-sun"
                }`}
              >
                {busy === plan.key
                  ? "Opening checkout…"
                  : current
                    ? `Renew, ${money(plan.priceMinor, plan.currency)}`
                    : `Choose ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {error && <p className="mt-3 text-sm text-clay">{error}</p>}

      {/* ------------------------------------------------------ promo code */}
      <div className="mt-4">
        {promo ? (
          <p className="text-xs text-ink-soft">
            Code <b className="font-mono">{promo.code}</b> is applied.{" "}
            <button
              onClick={() => {
                setPromo(null);
                setPromoInput("");
              }}
              className="underline underline-offset-2 hover:text-ink"
            >
              Remove it
            </button>
          </p>
        ) : promoOpen ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") void applyPromo();
              }}
              placeholder="PROMO CODE"
              autoFocus
              className="w-40 rounded-full border border-line bg-paper px-4 py-2 font-mono text-sm uppercase outline-none placeholder:font-sans focus:border-sun"
            />
            <button
              onClick={() => void applyPromo()}
              disabled={promoBusy || !promoInput.trim()}
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50"
            >
              {promoBusy ? "Checking…" : "Apply"}
            </button>
            {promoError && <span className="text-xs text-clay">{promoError}</span>}
          </div>
        ) : (
          <button
            onClick={() => setPromoOpen(true)}
            className="text-xs text-ink-faint underline underline-offset-2 hover:text-ink-soft"
          >
            Have a promo code?
          </button>
        )}
      </div>

      <p className="mt-3 text-xs text-ink-faint">
        One month at a time, nothing renews by itself. Secure checkout by Razorpay; card details
        never touch Kairo. Paying again adds a month to the end of the one you have, so nothing is
        wasted.
      </p>
    </>
  );
}
