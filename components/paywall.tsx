"use client";

import { useState } from "react";
import Script from "next/script";
import type { Access } from "@/lib/billing";
import { Icon3d } from "./img3d";

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

type Razorpay = new (options: Record<string, unknown>) => { open: () => void };
declare global {
  interface Window {
    Razorpay?: Razorpay;
  }
}

/** Opens Razorpay Checkout for a subscription and reports the outcome back. */
function useCheckout(user: { name: string; email: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/subscribe", { method: "POST" });
      const data = (await res.json()) as { subscriptionId?: string; keyId?: string; error?: string };
      if (!res.ok || !data.subscriptionId || !data.keyId) {
        throw new Error(data.error ?? "Could not start the subscription");
      }
      if (!window.Razorpay) throw new Error("Checkout didn't load — check your connection");

      const rzp = new window.Razorpay({
        key: data.keyId,
        subscription_id: data.subscriptionId,
        name: "Kairo",
        description: "Kairo subscription",
        prefill: { name: user.name, email: user.email },
        theme: { color: "#0c9384" },
        handler: async (response: Record<string, string>) => {
          // unlock straight away; the webhook confirms it independently
          const v = await fetch("/api/billing/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          if (v.ok) window.location.assign("/today");
          else setError("Payment taken, but confirming it failed. Refresh in a moment.");
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  };

  return { start, busy, error };
}

function PriceLine() {
  return (
    <p className="text-sm text-ink-soft">
      <b className="font-semibold text-ink">$5.99</b> a month. Cancel whenever you like.
    </p>
  );
}

/**
 * Shown instead of the app once the trial is over and nothing is paying for
 * it. Deliberately not dismissible — but it never hides anyone's data, and
 * signing out stays reachable.
 */
export function Paywall({ access, user }: { access: Access; user: { name: string; email: string } }) {
  const { start, busy, error } = useCheckout(user);

  return (
    <>
      <Script src={CHECKOUT_SRC} strategy="afterInteractive" />
      <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-paper px-5 py-10">
        <div className="w-full max-w-md text-center">
          <Icon3d name="sunrise" size={64} className="mx-auto" />
          <h1 className="font-display mt-4 text-3xl tracking-tight">
            {access.reason === "expired" ? "Your subscription has lapsed" : "Your free trial is over"}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
            Thanks for giving Kairo a proper go. Everything you&apos;ve added is safe and waiting —
            subscribe to pick up exactly where you left off.
          </p>

          <div className="mt-6 rounded-2xl border border-line bg-card p-6">
            <PriceLine />
            <button
              onClick={start}
              disabled={busy}
              className="mt-4 w-full rounded-2xl bg-sun px-6 py-3.5 text-base font-semibold text-on-accent shadow-lg shadow-sun/25 transition-transform active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? "Opening checkout…" : "Subscribe"}
            </button>
            {error && <p className="mt-3 text-sm text-clay">{error}</p>}
            <p className="mt-3 text-xs text-ink-faint">
              Secure checkout by Razorpay. Card details never touch Kairo.
            </p>
          </div>

          <form action="/api/auth/signout" method="POST" className="mt-6">
            <button type="submit" className="text-xs text-ink-faint underline underline-offset-2 hover:text-ink-soft">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

/**
 * A quiet strip during the trial, and while a subscription is in trouble.
 * Silent when there's nothing worth saying — nobody needs a banner every day.
 */
export function TrialBanner({ access, user }: { access: Access; user: { name: string; email: string } }) {
  const { start, busy } = useCheckout(user);
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
            ? "We couldn't take your last payment — please update your card."
            : access.trialDaysLeft <= 0
              ? "Your trial ends today."
              : `${access.trialDaysLeft} ${access.trialDaysLeft === 1 ? "day" : "days"} left of your free trial.`}
        </span>
        <button
          onClick={start}
          disabled={busy}
          className="font-semibold underline underline-offset-2 disabled:opacity-60"
        >
          {failing ? "Fix payment" : "Subscribe — $5.99/mo"}
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
