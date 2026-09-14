"use client";

import { useState } from "react";
import Script from "next/script";
import type { Access } from "@/lib/billing";
import { Icon3d } from "./img3d";
import { PlanCards, type FeatureLabel, type PublicPlan } from "./plan-cards";

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

type Razorpay = new (options: Record<string, unknown>) => {
  open: () => void;
  on?: (event: string, cb: (payload: never) => void) => void;
};
declare global {
  interface Window {
    Razorpay?: Razorpay;
  }
}

/**
 * Makes sure Razorpay Checkout is loaded, injecting the script on demand.
 *
 * The pages that sell preload it with a <Script> tag, but any surface that
 * forgets — the billing page did — used to throw "check your connection" at
 * someone whose connection was fine. Money buttons don't get to depend on a
 * sibling remembering a script tag.
 */
export function ensureCheckout(timeoutMs = 8000): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    let script = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = CHECKOUT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
    const timer = setTimeout(() => {
      clearInterval(poll);
      resolve(Boolean(window.Razorpay));
    }, timeoutMs);
    // poll rather than onload: the tag may already exist in any load state
    const poll = setInterval(() => {
      if (window.Razorpay) {
        clearTimeout(timer);
        clearInterval(poll);
        resolve(true);
      }
    }, 100);
    script.addEventListener("error", () => {
      clearTimeout(timer);
      clearInterval(poll);
      resolve(false);
    });
  });
}

type Mode = "subscription" | "one-off";

/**
 * Opens Razorpay Checkout and reports the outcome back.
 *
 * Two shapes, same button: a subscription mandate where the account supports
 * it, otherwise a single month's charge. The server decides which — the mode
 * arrives with the page, never from the client.
 */
export function useCheckout(user: { name: string; email: string }, mode: Mode) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * `plan` names what to buy; `promo` names a code, never an amount. The
   * price is never sent — the server reads it from the plan, applies the
   * code itself, and freezes the result onto the order.
   */
  const start = async (plan?: string, promo?: string) => {
    if (busy) return;
    setBusy(plan ?? "default");
    setError(null);
    try {
      const sub = mode === "subscription";
      const res = await fetch(sub ? "/api/billing/subscribe" : "/api/billing/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: plan ?? "", ...(promo ? { promo } : {}) }),
      });
      const data = (await res.json()) as {
        subscriptionId?: string; orderId?: string; amount?: number; currency?: string;
        keyId?: string; error?: string; free?: boolean;
      };
      // a 100% code needs no checkout: the month is already credited
      if (res.ok && data.free) {
        window.location.assign("/today");
        return;
      }
      if (!res.ok || !data.keyId || (sub ? !data.subscriptionId : !data.orderId)) {
        throw new Error(data.error ?? "Could not start the payment");
      }
      if (!(await ensureCheckout()) || !window.Razorpay) {
        throw new Error("Checkout didn't load, check your connection");
      }

      const rzp = new window.Razorpay({
        key: data.keyId,
        ...(sub
          ? { subscription_id: data.subscriptionId }
          : { order_id: data.orderId, amount: data.amount, currency: data.currency }),
        name: "Kairo",
        description: sub ? "Kairo subscription" : "Kairo, one month",
        prefill: { name: user.name, email: user.email },
        theme: { color: "#0c9384" },
        handler: async (response: Record<string, string>) => {
          const v = await fetch(sub ? "/api/billing/verify" : "/api/billing/verify-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          if (v.ok) window.location.assign("/today");
          else {
            const e = (await v.json().catch(() => ({}))) as { error?: string };
            setError(e.error ?? "Payment taken, but confirming it failed. Refresh in a moment.");
            setBusy(null);
          }
        },
        modal: { ondismiss: () => setBusy(null) },
      });
      // a card decline fires this rather than the handler
      rzp.on?.("payment.failed", (e: { error?: { description?: string } }) => {
        setError(e?.error?.description ?? "That payment didn't go through. Please try again.");
        setBusy(null);
      });
      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(null);
    }
  };

  return { start, busy, error };
}

/**
 * Shown instead of the app once the trial is over and nothing is paying for
 * it. Deliberately not dismissible — but it never hides anyone's data, and
 * signing out stays reachable.
 */
export function Paywall({
  access,
  user,
  mode,
  plans,
  features,
}: {
  access: Access;
  user: { name: string; email: string };
  mode: Mode;
  plans: PublicPlan[];
  features: FeatureLabel[];
}) {
  return (
    <div className="no-scrollbar fixed inset-0 z-[60] overflow-y-auto bg-paper px-5 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="text-center">
          <Icon3d name="sunrise" size={64} className="mx-auto" />
          <h1 className="font-display mt-4 text-3xl tracking-tight">
            {access.reason !== "expired"
              ? "Your free trial is over"
              : mode === "subscription"
                ? "Your subscription has lapsed"
                : "Your paid month is up"}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-ink-soft">
            Thanks for giving Kairo a proper go. Everything you&apos;ve added is safe and waiting, pick a plan to carry on exactly where you left off.
          </p>
        </div>

        <div className="mt-7">
          <PlanCards
            plans={plans}
            features={features}
            user={user}
            mode={mode}
            currentPlanKey={access.planKey}
          />
        </div>

        {/* a div, not a p: the sign-out form below is flow content, and the
            parser hoists it out of a paragraph — which breaks hydration */}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-ink-faint">
          <a href="/billing" className="underline underline-offset-2 hover:text-ink-soft">
            Billing &amp; receipts
          </a>
          {/* a lapsed card must never cost someone their own diary */}
          <form action="/api/journal/export" method="GET" className="inline">
            <button type="submit" className="underline underline-offset-2 hover:text-ink-soft">
              Download your journal
            </button>
          </form>
          <form action="/api/notes/export" method="GET" className="inline">
            <button type="submit" className="underline underline-offset-2 hover:text-ink-soft">
              Download your notes
            </button>
          </form>
          <a href="/refunds" className="underline underline-offset-2 hover:text-ink-soft">
            Refunds
          </a>
          <form action="/api/auth/signout" method="POST" className="inline">
            <button type="submit" className="underline underline-offset-2 hover:text-ink-soft">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/**
 * A quiet strip during the trial, and while a subscription is in trouble.
 * Silent when there's nothing worth saying — nobody needs a banner every day.
 */
export function TrialBanner({
  access,
  user,
  mode,
  price,
  planKey,
}: {
  access: Access;
  user: { name: string; email: string };
  mode: Mode;
  price: string;
  /** The plan the shown price belongs to. The button must charge THIS plan:
   *  an empty start() used to fall back to the dearest plan while the label
   *  showed the cheapest price. */
  planKey?: string;
}) {
  const { start, busy } = useCheckout(user, mode);
  const [dismissed, setDismissed] = useState(false);

  const failing = access.status === "halted" || access.status === "pending";
  // only speak up in the last two days, or if a payment is failing
  const nagging = access.reason === "trial" && access.trialDaysLeft <= 2;
  if (!access.paymentsEnabled || (!nagging && !failing) || (dismissed && !failing)) return null;

  return (
    <>
      <Script src={CHECKOUT_SRC} strategy="afterInteractive" />
      <div
        className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-xs ${
          failing ? "bg-clay-soft text-clay" : "bg-sun-soft text-sun-deep"
        }`}
      >
        <span>
          {failing
            ? "We couldn't take your last payment, please update your card."
            : access.trialDaysLeft <= 0
              ? "Your trial ends today."
              : `${access.trialDaysLeft} ${access.trialDaysLeft === 1 ? "day" : "days"} left of your free trial.`}
        </span>
        <button
          onClick={() => start(planKey)}
          disabled={Boolean(busy)}
          className="font-semibold underline underline-offset-2 disabled:opacity-60"
        >
          {failing ? "Fix payment" : mode === "subscription" ? `Subscribe, ${price}/mo` : `Pay ${price} for a month`}
        </button>
        {!failing && (
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        )}
      </div>
    </>
  );
}
