"use client";

import { useState } from "react";
import type { HabitView } from "@/lib/habits-shared";
import { Modal } from "../ui";
import { useGardenActions } from "./use-garden";

/**
 * Deleting a habit, asked once, plainly: what goes with it, that it can't
 * come back, and the gentler way out for someone who only wants a break.
 */
export function DeleteHabitDialog({ habit, onClose, onDone }: { habit: HabitView; onClose: () => void; onDone: () => void }) {
  const { remove, compost } = useGardenActions();
  const [busy, setBusy] = useState<"delete" | "archive" | null>(null);
  const archived = Boolean(habit.archivedAt);
  const days = habit.growth;

  return (
    <Modal onClose={onClose}>
      <div className="p-5" role="alertdialog" aria-labelledby="delete-habit-title" data-delete-habit>
        <h2 id="delete-habit-title" className="font-display text-2xl leading-tight">
          Delete “{habit.name}”?
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          This removes the habit{days > 0 ? ` and the ${days} ${days === 1 ? "day" : "days"} you marked it done` : ""}. It can&apos;t be undone.
        </p>
        {!archived && <p className="mt-2 text-sm text-ink-faint">Only taking a break? Archive it instead: it leaves your list and keeps its history.</p>}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="h-10 rounded-full px-4 text-sm font-semibold text-ink-soft hover:bg-paper-deep">
            Cancel
          </button>
          {!archived && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={async () => {
                setBusy("archive");
                const ok = await compost(habit, true);
                setBusy(null);
                if (ok) onDone();
              }}
              className="h-10 rounded-full border border-line px-4 text-sm font-semibold text-ink-soft transition-colors hover:border-ink-faint hover:text-ink disabled:opacity-60"
            >
              {busy === "archive" ? "Archiving…" : "Archive instead"}
            </button>
          )}
          <button
            type="button"
            disabled={busy !== null}
            onClick={async () => {
              setBusy("delete");
              const ok = await remove(habit);
              setBusy(null);
              if (ok) onDone();
            }}
            className="h-10 rounded-full bg-clay px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy === "delete" ? "Deleting…" : "Delete habit"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
