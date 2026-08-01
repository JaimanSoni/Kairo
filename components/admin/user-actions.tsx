"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Row-level actions on an account.
 *
 * All of them go through PATCH /api/admin/users, which re-checks the admin
 * allow-list server-side — the buttons only being rendered for an admin is a
 * convenience, not the control.
 */

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const send = async (body: Record<string, unknown>, failure: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? failure);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : failure);
    } finally {
      setBusy(false);
    }
  };

  return { busy, send };
}

/** Switches an account off, or back on. Nothing is deleted either way. */
export function ActiveToggle({
  userId,
  email,
  disabled,
  isSelf,
}: {
  userId: string;
  email: string;
  disabled: boolean;
  isSelf: boolean;
}) {
  const { busy, send } = useAction();

  if (isSelf) {
    return <span className="text-[11px] text-ink-faint">you</span>;
  }

  const toggle = async () => {
    if (busy) return;
    if (disabled) {
      if (!confirm(`Reactivate ${email}?\n\nThey'll be able to sign in again straight away.`)) return;
      await send({ userId, disabled: false }, "Could not reactivate the account");
      return;
    }
    const reason = prompt(
      `Deactivate ${email}?\n\nThey'll be signed out and can't sign back in. Nothing is deleted and you can undo this.\n\nOptional note (why):`,
      ""
    );
    if (reason === null) return;
    await send({ userId, disabled: true, reason }, "Could not deactivate the account");
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={disabled ? "Reactivate this account" : "Deactivate this account"}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
        disabled
          ? "border-clay/50 bg-clay-soft text-clay"
          : "border-line bg-card text-ink-faint hover:border-clay/50 hover:text-clay"
      }`}
    >
      {busy ? "…" : disabled ? "Off" : "Active"}
    </button>
  );
}

/**
 * Moves an account onto a different plan by hand.
 *
 * Changes what the current paid period unlocks; it takes no money and extends
 * nothing. For free access, use the comp toggle instead.
 */
export function PlanPicker({
  userId,
  planKey,
  plans,
}: {
  userId: string;
  planKey: string;
  plans: { key: string; name: string }[];
}) {
  const { busy, send } = useAction();

  return (
    <select
      value={planKey}
      disabled={busy}
      onChange={(e) => send({ userId, planKey: e.target.value }, "Could not change the plan")}
      aria-label="Plan"
      className="rounded-lg border border-line bg-card px-2 py-1 text-[11px] text-ink-soft disabled:opacity-50"
    >
      <option value="">none, </option>
      {plans.map((p) => (
        <option key={p.key} value={p.key}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
