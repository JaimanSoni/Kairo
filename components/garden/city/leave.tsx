"use client";

import { useState } from "react";
import { gardenApi, gardenStore } from "@/lib/habits-client";
import { track } from "@/lib/analytics-client";
import { Modal } from "../../ui";

/**
 * Leaving Kairo City, said plainly: what goes (the plot on the street, being
 * found, visited and cheered, the plots saved for friends) and what stays
 * (habits, friends, the name on the gate), before anything happens.
 */
export function LeaveCity({ onClose, onLeft }: { onClose: () => void; onLeft: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leave = async () => {
    setBusy(true);
    setError(null);
    const r = await gardenApi.leaveCity();
    setBusy(false);
    if (!r.ok) {
      setError(r.kind === "offline" ? "You're offline. Try again in a moment." : "That didn't go through. Try again.");
      return;
    }
    gardenStore.setGardener(r.data.gardener);
    track("city-leave");
    onLeft();
  };

  return (
    <Modal onClose={onClose} above>
      <div className="p-5" data-leave-city>
        <h2 className="font-display text-2xl leading-tight">Leave Kairo City?</h2>
        <ul className="mt-3 space-y-2 text-sm text-ink-soft">
          <li className="flex gap-2.5">
            <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-clay" aria-hidden />
            Your garden comes off the street. Nobody can find, visit or cheer it, and it leaves the habit leaderboards.
          </li>
          <li className="flex gap-2.5">
            <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-clay" aria-hidden />
            Plots you saved for friends are let go, and their invite links stop working.
          </li>
          <li className="flex gap-2.5">
            <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-moss" aria-hidden />
            Your habits and your garden stay just as they are, and so do your friends. Claim your plot again any time to come back.
          </li>
        </ul>
        {error && (
          <p role="alert" className="mt-3 text-sm text-clay">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-full px-4 text-sm font-semibold text-ink-soft hover:bg-paper-deep">
            Stay
          </button>
          <button type="button" disabled={busy} onClick={() => void leave()} className="h-10 rounded-full bg-clay px-5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60" data-confirm-leave>
            {busy ? "Leaving…" : "Leave the city"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
