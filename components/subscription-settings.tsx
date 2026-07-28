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
 * Subscription state in the profile sheet. Renders nothing at all while
 * payments are switched off — there is no subscription to talk about, and a
 * "you're on the free plan" row would only invite questions.
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

  if (!status || !status.paymentsEnabled) return null;

  const line =
    status.comped ? "Free access, on the house."
    : status.reason === "subscribed" ? `Subscribed${status.currentPeriodEnd ? ` · renews ${fmt(status.currentPeriodEnd)}` : ""}`
    : status.reason === "trial" ? `Free trial · ${status.trialDaysLeft} ${status.trialDaysLeft === 1 ? "day" : "days"} left`
    : status.reason === "grace" ? `Cancelled · access until ${fmt(status.currentPeriodEnd)}`
    : "No active subscription";

  return (
    <div className="mt-6">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
        Subscription
      </div>
      <Link
        href="/billing"
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-card px-4 py-2.5 transition-colors hover:border-sun"
      >
        <span className="text-sm text-ink-soft">{line}</span>
        <span className="shrink-0 text-xs font-semibold text-sun-deep">Manage →</span>
      </Link>
    </div>
  );
}
