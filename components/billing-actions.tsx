"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useCheckout } from "./paywall";
import { CHECKOUT_SRC } from "./plan-cards";

/**
 * Pay / cancel, for the billing page.
 *
 * Reuses the same checkout the paywall uses, so there is exactly one place
 * that knows how to take money and confirm it.
 */
export function BillingActions({
  mode,
  price,
  planKey,
  user,
  canCancel,
}: {
  mode: "subscription" | "one-off";
  price: string;
  /** Which plan to renew. Empty renews whatever the server picks as default. */
  planKey?: string;
  user: { name: string; email: string };
  canCancel: boolean;
}) {
  const router = useRouter();
  const { start, busy, error } = useCheckout(user, mode);
  const [cancelling, setCancelling] = useState(false);

  // a promo names a code, never a price: the server prices it, this only
  // previews what the server already decided
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

  const discount = promo && planKey ? promo.discounts[planKey] : undefined;
  const shownPrice = discount
    ? new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: discount.amountMinor % 100 === 0 ? 0 : 2,
      }).format(discount.amountMinor / 100)
    : price;

  const cancel = async () => {
    if (!confirm("Cancel your subscription? You'll keep access until the end of the period you've already paid for.")) return;
    setCancelling(true);
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      alert("Could not cancel. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      {/* preloaded so checkout opens instantly; ensureCheckout is the net */}
      <Script src={CHECKOUT_SRC} strategy="afterInteractive" />
      <button
        onClick={() => start(planKey, discount ? promo?.code : undefined)}
        disabled={Boolean(busy)}
        className="rounded-full bg-sun px-5 py-2.5 text-sm font-semibold text-on-accent shadow-lg shadow-sun/25 transition-transform active:scale-[0.99] disabled:opacity-60"
      >
        {busy
          ? "Opening checkout…"
          : mode === "subscription"
            ? `Subscribe, ${shownPrice}/mo`
            : `Pay ${shownPrice} for a month`}
      </button>
      {canCancel && (
        <button
          onClick={cancel}
          disabled={cancelling}
          className="text-xs font-medium text-ink-faint underline underline-offset-2 hover:text-clay disabled:opacity-50"
        >
          {cancelling ? "Cancelling…" : "Cancel subscription"}
        </button>
      )}

      {/* promo entry — the same flow the paywall's plan cards carry */}
      <div className="w-full">
        {promo && discount ? (
          <p className="text-xs text-ink-soft">
            Code <b className="font-mono">{promo.code}</b> applied, {discount.percentOff}% off.{" "}
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
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-sun/60 bg-sun-soft/40 px-4 py-2 text-[13px] font-semibold text-sun-deep transition-colors hover:bg-sun-soft"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M8.6 1.5H13a1.5 1.5 0 011.5 1.5v4.4a1.5 1.5 0 01-.44 1.06l-6.1 6.1a1.5 1.5 0 01-2.12 0l-4.4-4.4a1.5 1.5 0 010-2.12l6.1-6.1A1.5 1.5 0 018.6 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <circle cx="11.2" cy="4.8" r="1.1" fill="currentColor" />
            </svg>
            Have a promo code?
          </button>
        )}
      </div>

      {error && <p className="w-full text-sm text-clay">{error}</p>}
    </div>
  );
}
