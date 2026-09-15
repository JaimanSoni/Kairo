"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Subtask, Task } from "@/lib/types";
import { addDays, friendlyDay, localDayOf } from "@/lib/dates";
import { gardenStore } from "@/lib/habits-client";
import { hiddenListIds, useApp } from "./store";
import { TaskItem } from "./task-item";
import { ListMark } from "./img3d";
import { Chip, EmptyState } from "./ui";
import { monthsBetween, useGardenDays, useJournalMonths } from "./day/day-data";
import { DayJournal } from "./day/day-journal";

/** Watered plants bring the garden's art with them, so they load after the list. */
const DayHabits = dynamic(() => import("./day/day-habits"), { ssr: false });

/** How far back the Log reads plants and pages: the garden keeps ten weeks of days. */
const DAY_CONTEXT_DAYS = 70;

/** A finished step, carrying enough of its parent to make sense on its own. */
type StepWin = { kind: "step"; key: string; at: string; step: Subtask; parent: Task };
type TaskWin = { kind: "task"; key: string; at: string; task: Task };
type Win = StepWin | TaskWin;

/** A finished step, shown under the task it belongs to. */
function LoggedStep({ step, parent }: { step: Subtask; parent: Task }) {
  const { state } = useApp();
  const list = parent.listId ? state.lists.find((l) => l.id === parent.listId) : null;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line/70 bg-card/60 px-3.5 py-2.5">
      <span
        className="grid size-[18px] shrink-0 place-items-center rounded-full bg-moss text-on-accent"
        aria-hidden
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
          <path d="M3 8.5l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        {/* strike-done is the app-wide finished treatment — a step that
            reads differently from a task would look like a different thing */}
        <span className="strike-done block truncate text-[15px] leading-snug">
          {step.title}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <Chip tone="lilac" title="A step, not a whole task">
            ↳ step
          </Chip>
          <span className="truncate text-[11px] text-ink-faint">{parent.title}</span>
          {list && (
            <Chip>
              <ListMark value={list.emoji} size={13} /> {list.name}
            </Chip>
          )}
        </span>
      </span>
    </div>
  );
}

/**
 * The Log is the anti-guilt mirror: evidence of what you DID finish.
 * No streaks, no gaps highlighted — just wins, newest first. A day's wins
 * include the plants watered and the page written that day, with the
 * weather it had; a plant not watered never shows.
 */
export function LogView() {
  const { state } = useApp();
  const today = state.today;
  const context = !state.user.guest && !state.appLocked;
  const gardenReady = useGardenDays(context && state.user.spaces.garden, today, state.user.id);
  const journal = useJournalMonths(monthsBetween(addDays(today, -DAY_CONTEXT_DAYS), today), today, context && state.user.spaces.journal);
  const [older, setOlder] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/log?limit=300")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { tasks: Task[] }) => setOlder(data.tasks))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const done = useMemo(() => {
    const hidden = hiddenListIds(state);
    const merged = new Map<string, Task>();
    for (const t of older) merged.set(t.id, t);
    for (const t of Object.values(state.tasks)) {
      if (t.status === "done" && t.completedAt) merged.set(t.id, t);
      else merged.delete(t.id);
    }
    return [...merged.values()]
      .filter((t) => !(t.listId && hidden.has(t.listId)))
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  }, [older, state]);

  /**
   * Steps finished on their own count as work done.
   *
   * A step ticked off a task you haven't finished yet is still a thing you
   * did that day, and the Log exists to be evidence of that. Only steps with
   * a doneAt appear — ones ticked before this was recorded have no day to
   * belong to, and guessing one would be inventing history.
   */
  const stepWins = useMemo(() => {
    const hidden = hiddenListIds(state);
    const out: StepWin[] = [];
    const seen = new Set<string>();
    for (const t of [...Object.values(state.tasks), ...older]) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      if (t.listId && hidden.has(t.listId)) continue;
      for (const st of t.subtasks) {
        if (st.done && st.doneAt) {
          out.push({ kind: "step", key: `${t.id}:${st.id}`, at: st.doneAt, step: st, parent: t });
        }
      }
    }
    return out;
  }, [state, older]);

  /* the days something else was done: a plant watered, a page written */
  const since = addDays(today, -DAY_CONTEXT_DAYS);
  const wateredDays = new Map<string, number>();
  if (gardenReady) {
    for (const h of gardenStore.habits()) {
      for (const [date, log] of gardenStore.logs(h.id)) {
        if (log.done && date >= since && date <= today) wateredDays.set(date, (wateredDays.get(date) ?? 0) + 1);
      }
    }
  }
  const pageDays: string[] = [];
  if (journal.access === "ready") {
    for (let d = today; d >= since; d = addDays(d, -1)) if (journal.day(d)) pageDays.push(d);
  }
  const contextKey = `${[...wateredDays.keys()].sort().join()}|${pageDays.join()}`;

  const groups = useMemo(() => {
    const wins: Win[] = [
      ...done.map((t) => ({ kind: "task" as const, key: t.id, at: t.completedAt ?? "", task: t })),
      ...stepWins,
    ].sort((a, b) => b.at.localeCompare(a.at));

    const map = new Map<string, Win[]>();
    for (const w of wins) {
      const day = localDayOf(w.at);
      if (!day) continue;
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(w);
    }
    // a day with only a watered plant or a written page is still a day you showed up
    const [watered, pages] = contextKey.split("|");
    for (const day of [...watered.split(","), ...pages.split(",")]) {
      if (day && !map.has(day)) map.set(day, []);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [done, stepWins, contextKey]);

  const weekStart = addDays(today, -6);
  const doneThisWeek =
    done.filter((t) => t.completedAt && localDayOf(t.completedAt) >= weekStart).length +
    stepWins.filter((w) => localDayOf(w.at) >= weekStart).length;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-32 pt-8 sm:px-6">
      <header className="anim-rise mb-6">
        <h1 className="font-display text-4xl">Log</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Proof you show up. {doneThisWeek > 0 && (
            <>
              <b className="text-ink">{doneThisWeek}</b> finished in the last 7 days.
            </>
          )}
        </p>
      </header>

      {loading && done.length === 0 && (
        <div className="py-12 text-center text-sm text-ink-faint">Opening the archives…</div>
      )}

      {!loading && groups.length === 0 && (
        <EmptyState
          icon="book"
          title="Nothing here yet"
          body="Finish your first task and it lands here, the start of your evidence pile."
        />
      )}

      <div className="space-y-8">
        {groups.map(([day, wins]) => {
          const page = journal.day(day);
          return (
            <section key={day} data-log-day={day}>
              <div className="mb-2 flex items-baseline gap-2">
                <h2 className="text-sm font-bold">{friendlyDay(day, today)}</h2>
                {wins.length > 0 && (
                  <span className="text-xs text-ink-faint">
                    {wins.length} {wins.length === 1 ? "win" : "wins"}
                  </span>
                )}
              </div>
              {wins.length > 0 && (
                <div className="space-y-2 opacity-90">
                  {wins.map((w) =>
                    w.kind === "task" ? (
                      <TaskItem key={w.key} task={w.task} context="log" />
                    ) : (
                      <LoggedStep key={w.key} step={w.step} parent={w.parent} />
                    )
                  )}
                </div>
              )}
              {wateredDays.has(day) && <DayHabits date={day} today={today} wateredOnly className={wins.length > 0 ? "mt-3" : ""} />}
              {page && <DayJournal date={day} today={today} summary={page} access={journal.access} className="mt-3" />}
            </section>
          );
        })}
      </div>
    </div>
  );
}
