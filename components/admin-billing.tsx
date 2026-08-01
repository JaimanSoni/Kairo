"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The master switch. Off means Kairo is free for everyone regardless of
 * trials or subscriptions, which is also the safe state — so turning it on is
 * the action that asks for confirmation, not turning it off.
 */
export function PaymentsToggle({
  enabled,
  configured,
  webhookReady,
  price,
  trialDays,
  mode,
  keyMode,
}: {
  enabled: boolean;
  configured: boolean;
  webhookReady: boolean;
  price: string;
  trialDays: number;
  mode: "subscription" | "one-off";
  keyMode: "test" | "live" | "unset";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const terms =
    mode === "subscription"
      ? `${price}/month after a ${trialDays}-day trial`
      : `${price} a month after a ${trialDays}-day trial, paid one month at a time`;

  const set = async (next: boolean) => {
    if (busy) return;
    if (next) {
      const warning =
        keyMode === "test"
          ? "\n\nWARNING: these are TEST keys. Real cards will be declined, everyone past the trial would be locked out with no way to pay."
          : "";
      if (!confirm(`Turn payments on? Anyone past their ${trialDays}-day trial will have to pay ${price}.${warning}`)) {
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentsEnabled: next }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Payments</h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            {enabled
              ? `On, ${terms}. Comped accounts are unaffected.`
              : "Off, everyone uses Kairo free. Trials and payments are ignored."}
          </p>
        </div>
        <button
          onClick={() => set(!enabled)}
          disabled={busy || (!enabled && !configured)}
          aria-pressed={enabled}
          className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
            enabled
              ? "border border-clay/50 bg-clay-soft text-clay"
              : "bg-ink text-paper hover:opacity-90"
          }`}
        >
          {busy ? "Saving…" : enabled ? "Turn payments off" : "Turn payments on"}
        </button>
      </div>

      {!configured && (
        <p className="mt-3 rounded-lg bg-paper-deep px-3 py-2 text-xs text-ink-soft">
          Razorpay keys are missing, so payments can&apos;t be switched on. Set
          <code className="mx-1">RAZORPAY_KEY_ID</code> and
          <code className="mx-1">RAZORPAY_KEY_SECRET</code>. A plan id is only needed for
          recurring subscriptions; without one Kairo charges a month at a time.
        </p>
      )}
      {configured && keyMode === "test" && (
        <p className="mt-3 rounded-lg bg-clay-soft px-3 py-2 text-xs text-clay">
          <b>These are test keys.</b> Only Razorpay&apos;s fake cards work, a real customer&apos;s
          card is declined. Swap <code className="mx-1">RAZORPAY_KEY_ID</code>/
          <code className="mx-1">RAZORPAY_KEY_SECRET</code> for <code className="mx-1">rzp_live_…</code>
          keys before charging anyone.
        </p>
      )}
      {configured && !webhookReady && (
        <p className="mt-3 rounded-lg bg-clay-soft px-3 py-2 text-xs text-clay">
          <b>RAZORPAY_WEBHOOK_SECRET is unset.</b>{" "}
          {mode === "subscription"
            ? "Checkout will work, but renewals, failures and cancellations won't reach us, subscription states would silently go stale."
            : "Checkout will work, but only while the browser stays open to confirm it. If a customer's tab closes or their network drops after paying, the money arrives and their access doesn't."}
        </p>
      )}
      {error && <p className="mt-3 text-xs text-clay">{error}</p>}
    </div>
  );
}

/** Adds or removes an existing account from the free list. */
export function CompToggle({
  userId,
  comped,
  email,
}: {
  userId: string;
  comped: boolean;
  email: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    const next = !comped;
    if (next) {
      const note = prompt(`Give ${email} free access forever?\n\nOptional note (why):`, "");
      if (note === null) return;
      await send(next, note);
    } else {
      if (!confirm(`Remove free access for ${email}?`)) return;
      await send(next, "");
    }
  };

  const send = async (next: boolean, note: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/comp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, comped: next, note }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      alert("Could not update free access.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={comped ? "Remove free access" : "Give free access"}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
        comped
          ? "border-moss/50 bg-moss-soft text-moss"
          : "border-line bg-card text-ink-faint hover:border-sun hover:text-sun-deep"
      }`}
    >
      {busy ? "…" : comped ? "Free ✓" : "Make free"}
    </button>
  );
}
