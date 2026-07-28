"use client";

import { useState } from "react";
import Script from "next/script";
import type { Access } from "@/lib/billing";
import { Icon3d } from "./img3d";

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

type Mode = "subscription" | "one-off";

/**
 * Opens Razorpay Checkout and reports the outcome back.
 *
 * Two shapes, same button: a subscription mandate where the account supports
 * it, otherwise a single month's charge. The server decides which — the mode
 * arrives with the page, never from the client.
 */
export function useCheckout(user: { name: string; email: string }, mode: Mode) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const sub = mode === "subscription";
      const res = await fetch(sub ? "/api/billing/subscribe" : "/api/billing/order", { method: "POST" });
      const data = (await res.json()) as {
        subscriptionId?: string; orderId?: string; amount?: number; currency?: string;
        keyId?: string; error?: string;
      };
      if (!res.ok || !data.keyId || (sub ? !data.subscriptionId : !data.orderId)) {
        throw new Error(data.error ?? "Could not start the payment");
      }
      if (!window.Razorpay) throw new Error("Checkout didn't load — check your connection");

      const rzp = new window.Razorpay({
        key: data.keyId,
        ...(sub
          ? { subscription_id: data.subscriptionId }
          : { order_id: data.orderId, amount: data.amount, currency: data.currency }),
        name: "Kairo",
        description: sub ? "Kairo subscription" : "Kairo — one month",
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
            setBusy(false);
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      // a card decline fires this rather than the handler
      rzp.on?.("payment.failed", (e: { error?: { description?: string } }) => {
        setError(e?.error?.description ?? "That payment didn't go through. Please try again.");
        setBusy(false);
      });
      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  };

  return { start, busy, error };
}

function PriceLine({ price, mode }: { price: string; mode: Mode }) {
  return (
    <p className="text-sm text-ink-soft">
      <b className="font-semibold text-ink">{price}</b>{" "}
      {mode === "subscription" ? "a month. Cancel whenever you like." : "for a month. Renew whenever you like — nothing recurring."}
    </p>
  );
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
  price,
}: {
  access: Access;
  user: { name: string; email: string };
  mode: Mode;
  price: string;
}) {
  const { start, busy, error } = useCheckout(user, mode);

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
            <PriceLine price={price} mode={mode} />
            <button
              onClick={start}
              disabled={busy}
              className="mt-4 w-full rounded-2xl bg-sun px-6 py-3.5 text-base font-semibold text-on-accent shadow-lg shadow-sun/25 transition-transform active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? "Opening checkout…" : mode === "subscription" ? "Subscribe" : `Pay ${price}`}
            </button>
            {error && <p className="mt-3 text-sm text-clay">{error}</p>}
            <p className="mt-3 text-xs text-ink-faint">
              Secure checkout by Razorpay. Card details never touch Kairo.
            </p>
          </div>

          <p className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-ink-faint">
            <a href="/billing" className="underline underline-offset-2 hover:text-ink-soft">
              Billing &amp; receipts
            </a>
            <a href="/refunds" className="underline underline-offset-2 hover:text-ink-soft">
              Refunds
            </a>
            <form action="/api/auth/signout" method="POST" className="inline">
              <button type="submit" className="underline underline-offset-2 hover:text-ink-soft">
                Sign out
              </button>
            </form>
          </p>
        </div>
      </div>
    </>
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
}: {
  access: Access;
  user: { name: string; email: string };
  mode: Mode;
  price: string;
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
          {failing ? "Fix payment" : mode === "subscription" ? `Subscribe — ${price}/mo` : `Pay ${price} for a month`}
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
