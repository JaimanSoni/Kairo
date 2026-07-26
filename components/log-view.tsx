"use client";

import { useEffect, useMemo, useState } from "react";
import type { Task } from "@/lib/types";
import { addDays, friendlyDay, todayStr } from "@/lib/dates";
import { hiddenListIds, useApp } from "./store";
import { TaskItem } from "./task-item";
import { EmptyState } from "./ui";

/**
 * The Log is the anti-guilt mirror: evidence of what you DID finish.
 * No streaks, no gaps highlighted — just wins, newest first.
 */
export function LogView() {
  const { state } = useApp();
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

  const groups = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of done) {
      const day = (t.completedAt ?? "").slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(t);
    }
    return [...map.entries()];
  }, [done]);

  const today = todayStr();
  const weekStart = addDays(today, -6);
  const doneThisWeek = done.filter((t) => (t.completedAt ?? "").slice(0, 10) >= weekStart).length;

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

      {!loading && done.length === 0 && (
        <EmptyState
          icon="book"
          title="Nothing here yet"
          body="Finish your first task and it lands here — the start of your evidence pile."
        />
      )}

      <div className="space-y-8">
        {groups.map(([day, tasks]) => (
          <section key={day}>
            <div className="mb-2 flex items-baseline gap-2">
              <h2 className="text-sm font-bold">{friendlyDay(day, today)}</h2>
              <span className="text-xs text-ink-faint">
                {tasks.length} {tasks.length === 1 ? "win" : "wins"}
              </span>
            </div>
            <div className="space-y-2 opacity-90">
              {tasks.map((t) => (
                <TaskItem key={t.id} task={t} context="log" />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
