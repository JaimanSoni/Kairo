"use client";

import { useState } from "react";
import type { Task } from "@/lib/types";
import { friendlyDay } from "@/lib/dates";
import { useApp, type SweepAction } from "./store";
import { Icon3d } from "./img3d";
import { Chip, IconArrowRight, IconX } from "./ui";

const CHOICES: { value: SweepAction; label: string; hint: string }[] = [
  { value: "today", label: "Today", hint: "I'll do it today" },
  { value: "later", label: "Later", hint: "Back to inbox, no date" },
  { value: "someday", label: "Someday", hint: "Park it, guilt-free" },
  { value: "done", label: "Did it", hint: "Actually finished it" },
  { value: "letgo", label: "Let go", hint: "It doesn't matter anymore" },
];

/* repeating tasks can't be deleted or parked from the sweep — skip keeps the series alive */
const CHOICES_RECURRING: { value: SweepAction; label: string; hint: string }[] = [
  { value: "today", label: "Today", hint: "Do it today" },
  { value: "done", label: "Did it", hint: "Log the win, roll to the next date" },
  { value: "letgo", label: "Skip", hint: "Jump to the next occurrence, no guilt" },
];

/**
 * The anti-"62 overdue tasks" mechanic: unfinished tasks from previous days
 * are swept each morning with one decision each — never left to rot in red.
 * It sits at the top of Today rather than over it, so the day stays in view
 * while yesterday is settled; "Not now" folds it into a pill.
 */
export function FreshStart({ carryover }: { carryover: Task[] }) {
  const { state, sweep, dismissSweep } = useApp();
  const [decisions, setDecisions] = useState<Record<string, SweepAction>>(() =>
    Object.fromEntries(carryover.map((t) => [t.id, (t.repeat ? "today" : "later") as SweepAction]))
  );

  const setAll = (action: SweepAction) =>
    setDecisions(Object.fromEntries(carryover.map((t) => [t.id, action])));

  const apply = () => {
    sweep(carryover.map((t) => ({ id: t.id, action: decisions[t.id] ?? "later" })));
  };

  return (
    <section aria-label="Fresh start" data-fresh-start className="anim-rise mb-6 rounded-3xl border border-line bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Icon3d name="sunrise" size={40} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl">Fresh start</h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            {`${carryover.length === 1 ? "One thing" : `${carryover.length} things`} from before didn't get done, that's what tomorrows are for. Decide once, move on.`}
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

      <div className="no-scrollbar mt-4 max-h-[45vh] space-y-2 overflow-y-auto overscroll-contain">
        {carryover.map((t) => (
          <div key={t.id} className="rounded-2xl border border-line bg-paper p-3">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[15px]">{t.title}</span>
              <span className="shrink-0 text-xs text-ink-faint">planned {friendlyDay(t.plannedFor!, state.today).toLowerCase()}</span>
              {t.repeat && <Chip tone="sky" title="A repeating task">↻ repeats</Chip>}
              {t.carryCount >= 2 && (
                <Chip tone="lilac" title="This one keeps coming back">↻ ×{t.carryCount}</Chip>
              )}
            </div>
            {t.carryCount >= 2 && (
              <p className="mt-1.5 text-xs text-lilac">
                Keeps carrying over, too big? Try breaking it into steps, or let it go. Both are wins.
              </p>
            )}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {(t.repeat ? CHOICES_RECURRING : CHOICES).map((c) => (
                <button
                  key={c.value}
                  data-tip={c.hint}
                  aria-pressed={decisions[t.id] === c.value}
                  onClick={() => setDecisions((d) => ({ ...d, [t.id]: c.value }))}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    decisions[t.id] === c.value
                      ? c.value === "letgo" && !t.repeat
                        ? "border-clay bg-clay-soft text-clay"
                        : c.value === "done"
                          ? "border-moss bg-moss-soft text-moss"
                          : "border-sun bg-sun-soft text-sun-deep"
                      : "border-line bg-card text-ink-soft hover:border-ink-faint"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        {carryover.length > 1 ? (
          <span className="flex gap-1.5 text-xs">
            <button onClick={() => setAll("today")} className="rounded-full border border-line px-3 py-1 text-ink-soft hover:border-sun hover:text-sun-deep">
              All to today
            </button>
            <button onClick={() => setAll("later")} className="rounded-full border border-line px-3 py-1 text-ink-soft hover:border-ink-faint">
              All to later
            </button>
          </span>
        ) : (
          <span />
        )}
        <button
          onClick={apply}
          className="flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-xs font-semibold text-paper transition-transform hover:-translate-y-0.5"
        >
          Start the day <IconArrowRight size={13} />
        </button>
      </div>
    </section>
  );
}
