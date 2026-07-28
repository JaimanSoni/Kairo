"use client";

import { useCallback } from "react";
import type { Subtask, Task } from "@/lib/types";
import { friendlyDay } from "@/lib/dates";
import { playComplete } from "@/lib/sound";
import { useApp } from "./store";
import { IconCheck } from "./ui";

/**
 * Toggling a step lives here so the card checklist, the editor, and the
 * planned-step rows all behave identically — including the "all steps done,
 * finish the task?" nudge.
 */
export function useStepToggle() {
  const { updateTask, completeTask, showToast, getTask } = useApp();

  return useCallback(
    (taskId: string, stepId: string) => {
      const task = getTask(taskId);
      if (!task) return;
      const updated = task.subtasks.map((s) =>
        s.id === stepId
          // stamped on the way in, cleared on the way out — a step that isn't
          // done has no completion time
          ? { ...s, done: !s.done, doneAt: !s.done ? new Date().toISOString() : null }
          : s
      );
      const turnedOn = updated.find((s) => s.id === stepId)?.done;
      if (turnedOn) playComplete();
      updateTask(taskId, { subtasks: updated });

      if (turnedOn && updated.length > 0 && updated.every((s) => s.done) && task.status !== "done") {
        showToast({
          message: "All steps done 🎉",
          action: { label: "Finish the task", run: () => completeTask(taskId) },
        });
      }
    },
    [getTask, updateTask, completeTask, showToast]
  );
}

/**
 * A step scheduled onto a day, shown on Today/Upcoming as a compact row
 * under its own power — linked back to the parent task.
 */
export function StepRow({ task, step }: { task: Task; step: Subtask }) {
  const { state, setEditing } = useApp();
  const toggleStep = useStepToggle();
  const today = state.today;
  const overdue = step.plannedFor && step.plannedFor < today;

  return (
    <div className="group flex select-none items-center gap-3 rounded-xl border border-line/70 bg-card/70 px-3.5 py-2 transition-transform duration-150 active:scale-[0.99]">
      <button
        onClick={() => toggleStep(task.id, step.id)}
        aria-label={step.done ? "Mark step as not done" : "Mark step as done"}
        className={`grid size-[18px] shrink-0 place-items-center rounded-full border-2 transition-colors ${
          step.done
            ? "border-moss bg-moss text-on-accent"
            : "border-ink-faint text-transparent hover:border-moss"
        }`}
      >
        <IconCheck size={10} />
      </button>
      <button
        className="flex min-w-0 flex-1 items-baseline gap-2 text-left"
        onClick={() => setEditing(task.id)}
        title={`Part of: ${task.title}`}
      >
        <span className={`truncate text-sm ${step.done ? "text-ink-faint line-through" : ""}`}>
          {step.title}
        </span>
        <span className="hidden truncate text-xs text-ink-faint sm:inline">↳ {task.title}</span>
      </button>
      {overdue && !step.done && (
        <span className="shrink-0 rounded-md bg-paper-deep px-1.5 py-0.5 text-[11px] text-ink-soft">
          from {friendlyDay(step.plannedFor!, today).toLowerCase()}
        </span>
      )}
    </div>
  );
}
