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
        onClick={() => start(planKey)}
        disabled={Boolean(busy)}
        className="rounded-full bg-sun px-5 py-2.5 text-sm font-semibold text-on-accent shadow-lg shadow-sun/25 transition-transform active:scale-[0.99] disabled:opacity-60"
      >
        {busy
          ? "Opening checkout…"
          : mode === "subscription"
            ? `Subscribe, ${price}/mo`
            : `Pay ${price} for a month`}
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
      {error && <p className="w-full text-sm text-clay">{error}</p>}
    </div>
  );
}
