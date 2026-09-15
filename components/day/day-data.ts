"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { journalApi, journalCache } from "@/lib/journal-client";
import { gardenStore } from "@/lib/habits-client";
import { isScheduledDay, type HabitView } from "@/lib/habits-shared";
import type { JournalSummary } from "@/lib/journal-shared";

/**
 * A day, as every part of Kairo knows it. The Calendar, the Log, Today and a
 * journal page each used to know one slice; these read the others' slices so
 * any of them can show the whole day: what was planned and finished, which
 * plants were watered, and how it felt.
 */

/* --------------------------------------------------------------- journal */

export type JournalAccess = "loading" | "ready" | "locked" | "error" | "off";

/** How long a month's summaries count as fresh before a view asks again. */
const FRESH_MS = 60_000;
const loadedAt = new Map<string, number>();
const inFlight = new Map<string, Promise<JournalAccess>>();

function lastDayOf(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
}

function loadMonth(month: string, today: string): Promise<JournalAccess> {
  const cache = journalCache.get();
  const at = loadedAt.get(month) ?? 0;
  if (cache.months.has(month) && Date.now() - at < FRESH_MS) return Promise.resolve("ready");
  const running = inFlight.get(month);
  if (running) return running;
  const end = lastDayOf(month);
  const run = journalApi
    .range(`${month}-01`, end < today ? end : today)
    .then((r): JournalAccess => {
      if (r.ok) {
        journalCache.loadMonth(month, r.data.entries);
        loadedAt.set(month, Date.now());
        return "ready";
      }
      return r.kind === "locked" ? "locked" : "error";
    })
    .finally(() => inFlight.delete(month));
  inFlight.set(month, run);
  return run;
}

/**
 * The journal's pages for some months ("2026-09"), as summaries by date.
 * Months after today's hold no pages and are never asked for. A PIN-locked
 * journal reports "locked" and shows nothing.
 */
export function useJournalMonths(months: string[], today: string, enabled: boolean) {
  useSyncExternalStore(journalCache.subscribe, journalCache.snapshot, journalCache.snapshot);
  const key = [...new Set(months)].filter((m) => m <= today.slice(0, 7)).sort().join(",");
  const [result, setResult] = useState<{ key: string; access: JournalAccess }>({ key: "", access: "loading" });

  useEffect(() => {
    if (!enabled || !key) return;
    let cancelled = false;
    Promise.all(key.split(",").map((m) => loadMonth(m, today))).then((all) => {
      if (cancelled) return;
      setResult({ key, access: all.includes("locked") ? "locked" : all.includes("error") ? "error" : "ready" });
    });
    return () => {
      cancelled = true;
    };
  }, [key, today, enabled]);

  const access: JournalAccess = !enabled ? "off" : !key ? "ready" : result.key === key ? result.access : "loading";
  const days = journalCache.get().days;
  return {
    access,
    day: (date: string): JournalSummary | null => (access === "ready" ? days.get(date) ?? null : null),
  };
}

/** The months a run of dates touches, oldest first. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.slice(0, 7).split("-").map(Number);
  const [ty, tm] = to.slice(0, 7).split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
    if (out.length > 24) break;
  }
  return out;
}

/* ---------------------------------------------------------------- garden */

export type DayHabit = { habit: HabitView; done: boolean; count: number };

/**
 * The plants of a day: those watered, and those the day asked for that
 * weren't. A weekly habit asks for no particular day, so it only counts when
 * it was watered. The store holds the last ten weeks; older days show none.
 */
export function habitsOn(date: string, today: string): { watered: DayHabit[]; waiting: DayHabit[] } {
  if (gardenStore.status() !== "ready") return { watered: [], waiting: [] };
  const watered: DayHabit[] = [];
  const waiting: DayHabit[] = [];
  for (const habit of gardenStore.habits()) {
    if (habit.startDate > date) continue;
    const log = gardenStore.logs(habit.id).get(date);
    const item = { habit, done: Boolean(log?.done), count: log?.count ?? 0 };
    if (item.done) {
      watered.push(item);
    } else if (date === today ? gardenStore.live(habit, today).dueToday : habit.schedule.kind !== "weekly" && isScheduledDay(habit.schedule, date)) {
      waiting.push(item);
    }
  }
  return { watered, waiting };
}

/** Keeps a view drawing from the garden store, and has it load when it hasn't. */
export function useGardenDays(enabled: boolean, today: string, userId: string) {
  useSyncExternalStore(gardenStore.subscribe, gardenStore.snapshot, () => 0);
  useEffect(() => {
    if (!enabled) return;
    gardenStore.forUser(userId);
    void gardenStore.refresh(today);
  }, [enabled, today, userId]);
  return enabled && gardenStore.status() === "ready";
}
