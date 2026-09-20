"use client";

import { useState } from "react";
import type { Task } from "@/lib/types";
import { friendlyDay } from "@/lib/dates";
import { useApp, type SweepAction } from "./store";
import { Icon3d } from "./img3d";
import { IconArrowRight, IconX } from "./ui";

/**
 * The anti-"62 overdue tasks" mechanic: unfinished tasks from previous days
 * are settled each morning with one decision each, never left to rot in red.
 * It sits at the top of Today rather than over it, so the day stays in view
 * while yesterday is settled; the cross folds it away for now.
 *
 * Each task gets one row of answers in the app's own words (the same Today,
 * Tomorrow and Someday as everywhere else), and a line under it says exactly
 * what the chosen answer will do. Nothing happens until "Start the day", so
 * changing your mind costs nothing. "Did it" logs the task on the day it was
 * planned for: yesterday's win belongs to yesterday.
 */

type Choice = { value: SweepAction; label: string };

const CHOICES: Choice[] = [
  { value: "done", label: "Did it" },
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "someday", label: "Someday" },
  { value: "letgo", label: "Delete" },
];

/* a repeating task is never deleted or parked from here: skipping keeps the series alive */
const CHOICES_RECURRING: Choice[] = [
  { value: "done", label: "Did it" },
  { value: "today", label: "Today" },
  { value: "letgo", label: "Skip it" },
];

/** What an answer will do, in plain words. */
function outcome(action: SweepAction, task: Task, today: string): string {
  const day = task.plannedFor ? friendlyDay(task.plannedFor, today).toLowerCase() : "earlier";
  if (task.repeat) {
    if (action === "done") return `Logged as done ${day}, and it comes back on its next date.`;
    if (action === "today") return "Goes on today's plan.";
    return "Skips this one. It comes back on its next date.";
  }
  switch (action) {
    case "done":
      return `Logged as done ${day}, not today.`;
    case "today":
      return "Goes on today's plan.";
    case "tomorrow":
      return "Moves to tomorrow.";
    case "someday":
      return "Parked in Someday. No date, no pressure.";
    case "letgo":
      return "Deleted for good.";
    default:
      return "Back to your Inbox, with no date.";
  }
}

export function FreshStart({ carryover }: { carryover: Task[] }) {
  const { state, sweep, dismissSweep } = useApp();
  // everything starts on Today: the answer that loses nothing if it's left alone
  const [decisions, setDecisions] = useState<Record<string, SweepAction>>(() => Object.fromEntries(carryover.map((t) => [t.id, "today" as SweepAction])));

  const setAll = (action: SweepAction) => setDecisions(Object.fromEntries(carryover.map((t) => [t.id, action])));
  const apply = () => sweep(carryover.map((t) => ({ id: t.id, action: decisions[t.id] ?? "today" })));
  const many = carryover.length > 1;

  return (
    <section aria-label="Fresh start" data-fresh-start className="anim-rise mb-6 rounded-3xl border border-line bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <Icon3d name="sunrise" size={40} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl">Fresh start</h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            {carryover.length === 1 ? "One thing is left from before." : `${carryover.length} things are left from before.`} Say what happens to {many ? "each" : "it"}, then start clean.
          </p>
        </div>
        <button
          onClick={dismissSweep}
          aria-label="Not now"
          title="Not now"
          className="grid size-8 shrink-0 place-items-center rounded-full text-ink-faint transition-colors hover:bg-paper-deep hover:text-ink"
        >
          <IconX size={14} />
        </button>
      </div>

      <div className="no-scrollbar mt-5 max-h-[52vh] space-y-5 overflow-y-auto overscroll-contain">
        {carryover.map((t) => {
          const choices = t.repeat ? CHOICES_RECURRING : CHOICES;
          const chosen = decisions[t.id] ?? "today";
          return (
            <div key={t.id} data-sweep-task={t.id}>
              <div className="flex items-baseline gap-2 px-1">
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{t.title}</span>
                <span className="shrink-0 text-xs text-ink-faint">
                  from {friendlyDay(t.plannedFor!, state.today).toLowerCase()}
                  {t.repeat ? " · repeats" : ""}
                </span>
              </div>
              <div role="radiogroup" aria-label={`What happens to ${t.title}`} className="mt-2 grid gap-1 rounded-2xl bg-paper-deep p-1" style={{ gridTemplateColumns: choices.length === 5 ? "0.9fr 0.9fr 1.35fr 1.2fr 0.95fr" : `repeat(${choices.length}, minmax(0, 1fr))` }}>
                {choices.map((c) => {
                  const on = chosen === c.value;
                  return (
                    <button
                      key={c.value}
                      role="radio"
                      aria-checked={on}
                      data-sweep-choice={c.value}
                      onClick={() => setDecisions((d) => ({ ...d, [t.id]: c.value }))}
                      className={`h-9 min-w-0 whitespace-nowrap rounded-xl text-xs tracking-tight transition-colors sm:text-[13px] sm:tracking-normal ${
                        on ? `te-pop bg-card font-semibold shadow-sm ${c.value === "done" ? "text-moss" : c.value === "letgo" && !t.repeat ? "text-clay" : "text-ink"}` : "font-medium text-ink-soft hover:text-ink"
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
              <p key={chosen} className="te-say mt-1.5 px-1 text-[13px] leading-5 text-ink-soft" data-sweep-outcome>
                {outcome(chosen, t, state.today)}
                {t.carryCount >= 2 && chosen === "today" && <span className="text-lilac"> It has carried over {t.carryCount} times: smaller steps may help.</span>}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        {many ? (
          <span className="flex items-center gap-1 text-[13px] text-ink-faint">
            All:
            <button onClick={() => setAll("today")} className="rounded-full px-2 py-1 font-medium text-ink-soft hover:bg-paper-deep hover:text-ink">
              Today
            </button>
            <button onClick={() => setAll("tomorrow")} className="rounded-full px-2 py-1 font-medium text-ink-soft hover:bg-paper-deep hover:text-ink">
              Tomorrow
            </button>
            <button onClick={() => setAll("done")} className="rounded-full px-2 py-1 font-medium text-ink-soft hover:bg-paper-deep hover:text-ink">
              Did it
            </button>
          </span>
        ) : (
          <span />
        )}
        <button onClick={apply} className="flex h-10 items-center gap-1.5 rounded-full bg-ink px-5 text-sm font-semibold text-paper transition-transform hover:-translate-y-0.5" data-sweep-apply>
          Start the day <IconArrowRight size={13} />
        </button>
      </div>
    </section>
  );
}
