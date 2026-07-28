"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Access } from "@/lib/access";

type Status = Access & { comped: boolean; canCancel: boolean };

function fmt(ms?: number): string {
  if (!ms) return "";
  return new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * The way into billing from the app, and a one-line summary of where you
 * stand. Always shown: hiding it while payments are off left no route to
 * receipts at all, which is the one thing people go looking for.
 */
export function SubscriptionSettings() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/billing/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Status | null) => {
        if (!cancelled && d) setStatus(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status) return null;

  const line =
    !status.paymentsEnabled ? "Free for everyone right now."
    : status.comped ? "Free access, on the house."
    : status.reason === "subscribed" ? `Subscribed${status.currentPeriodEnd ? ` · renews ${fmt(status.currentPeriodEnd)}` : ""}`
    : status.reason === "trial" ? `Free trial · ${status.trialDaysLeft} ${status.trialDaysLeft === 1 ? "day" : "days"} left`
    : status.reason === "grace" ? `Cancelled · access until ${fmt(status.currentPeriodEnd)}`
    : "No active subscription";

  return (
    <div className="mt-6">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
        Billing
      </div>
      <Link
        href="/billing"
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-card px-4 py-2.5 transition-colors hover:border-sun"
      >
        <span className="text-sm text-ink-soft">{line}</span>
        <span className="shrink-0 text-xs font-semibold text-sun-deep">
          {status.paymentsEnabled ? "Manage" : "View"} →
        </span>
      </Link>
    </div>
  );
}
