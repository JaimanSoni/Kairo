"use client";

import { useState } from "react";
import type { Task } from "@/lib/types";
import { friendlyDay } from "@/lib/dates";
import { useApp, type SweepAction } from "./store";
import { Icon3d } from "./img3d";
import { Chip, Modal } from "./ui";

const CHOICES: { value: SweepAction; label: string; hint: string }[] = [
  { value: "today", label: "Today", hint: "I'll do it today" },
  { value: "later", label: "Later", hint: "Back to inbox — no date" },
  { value: "someday", label: "Someday", hint: "Park it, guilt-free" },
  { value: "done", label: "Did it", hint: "Actually finished it" },
  { value: "letgo", label: "Let go", hint: "It doesn't matter anymore" },
];

/**
 * The anti-"62 overdue tasks" mechanic: unfinished tasks from previous days
 * are swept each morning with one decision each — never left to rot in red.
 */
export function FreshStart({ carryover }: { carryover: Task[] }) {
  const { state, sweep, dismissSweep } = useApp();
  const [decisions, setDecisions] = useState<Record<string, SweepAction>>(() =>
    Object.fromEntries(carryover.map((t) => [t.id, "later" as SweepAction]))
  );

  const setAll = (action: SweepAction) =>
    setDecisions(Object.fromEntries(carryover.map((t) => [t.id, action])));

  const apply = () => {
    sweep(carryover.map((t) => ({ id: t.id, action: decisions[t.id] ?? "later" })));
  };

  return (
    <Modal onClose={dismissSweep} wide>
      <div className="p-6">
        <Icon3d name="sunrise" size={52} />
        <h2 className="font-display mt-2 text-3xl">Fresh start</h2>
        <p className="mt-1 text-sm text-ink-soft">
          {carryover.length === 1 ? "One thing" : `${carryover.length} things`} from before didn&apos;t
          get done — that&apos;s what tomorrows are for. Decide once, move on.
        </p>

        <div className="mt-4 flex gap-2 text-xs">
          <button onClick={() => setAll("today")} className="rounded-full border border-line px-3 py-1 hover:border-sun hover:text-sun-deep">
            all → today
          </button>
          <button onClick={() => setAll("later")} className="rounded-full border border-line px-3 py-1 hover:border-ink-faint">
            all → later
          </button>
        </div>

        <div className="mt-4 max-h-[45vh] space-y-3 overflow-y-auto overscroll-contain pr-1">
          {carryover.map((t) => (
            <div key={t.id} className="rounded-xl border border-line bg-paper p-3.5">
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate text-[15px]">{t.title}</span>
                <span className="text-xs text-ink-faint">
                  planned {friendlyDay(t.plannedFor!, state.today).toLowerCase()}
                </span>
                {t.carryCount >= 2 && (
                  <Chip tone="lilac" title="This one keeps coming back">↻ ×{t.carryCount}</Chip>
                )}
              </div>
              {t.carryCount >= 2 && (
                <p className="mt-1.5 text-xs text-lilac">
                  Keeps carrying over — too big? Try breaking it into steps, or let it go. Both are wins.
                </p>
              )}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {CHOICES.map((c) => (
                  <button
                    key={c.value}
                    title={c.hint}
                    onClick={() => setDecisions((d) => ({ ...d, [t.id]: c.value }))}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      decisions[t.id] === c.value
                        ? c.value === "letgo"
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

        <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
          <button onClick={dismissSweep} className="text-sm text-ink-faint hover:text-ink">
            Not now
          </button>
          <button
            onClick={apply}
            className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-paper hover:opacity-90"
          >
            Start the day →
          </button>
        </div>
      </div>
    </Modal>
  );
}
