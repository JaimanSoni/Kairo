"use client";

import { useEffect, useState } from "react";
import type { Access } from "@/lib/access";

type Status = Access & { comped: boolean; canCancel: boolean };

function fmt(ms?: number): string {
  if (!ms) return "";
  return new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Where you stand with billing, in a line: the way into /billing from
 * Settings. Always offered: hiding it while payments are off left no route to
 * receipts at all, which is the one thing people go looking for.
 */
export function useSubscriptionSummary(): { line: string; action: string } | null {
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
  return { line, action: status.paymentsEnabled ? "Manage" : "View" };
}
