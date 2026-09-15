"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { gardenApi, gardenStore } from "@/lib/habits-client";
import { plantStageFor, strengthLevel, strengthOf, type HabitView, type LiveHabit, type StrengthLevel } from "@/lib/habits-shared";
import { track } from "@/lib/analytics-client";
import { useApp } from "../store";
import { buzz, plink } from "./fx";

/** The habits store, loaded once and kept fresh across midnight. */
export function useGarden() {
  useSyncExternalStore(gardenStore.subscribe, gardenStore.snapshot, () => 0);
  const { state } = useApp();
  const guest = Boolean(state.user.guest);
  const today = state.today;
  const userId = state.user.id;

  useEffect(() => {
    if (guest) return;
    gardenStore.forUser(userId);
    void gardenStore.refresh(today);
  }, [guest, today, userId]);

  return {
    status: gardenStore.status(),
    habits: gardenStore.habits(),
    archived: gardenStore.archived(),
    gardener: gardenStore.gardener(),
    today,
    guest,
  };
}

export type PlotInfo = {
  habit: HabitView;
  live: LiveHabit;
  /** 0–100: how rooted the habit is. */
  strength: number;
  level: StrengthLevel;
  /** The plant drawn for it, from its strength. */
  stage: number;
  /** Due today (or this week) and not done yet. */
  due: boolean;
  /** The streak to show: while yesterday can still be marked, the streak it would keep. */
  streak: number;
};

export function plotOf(habit: HabitView, today: string): PlotInfo {
  const lv = gardenStore.live(habit, today);
  const logs = gardenStore.logs(habit.id);
  const strength = strengthOf({ schedule: habit.schedule, startDate: habit.startDate }, logs, today);
  const rescuable = lv.rescue && !lv.rescue.covered;
  return {
    habit,
    live: lv,
    strength,
    level: strengthLevel(strength),
    stage: plantStageFor(strength, habit.growth > 0 || lv.todayDone),
    due: lv.dueToday && !lv.todayDone,
    streak: rescuable ? Math.max(lv.streak, lv.rescue!.keeps) : lv.streak,
  };
}

export type Moments = Record<string, { water: number; burst: number }>;

/** Whether every habit that asks for something today has had it. */
function allDueDone(today: string): boolean {
  let due = 0;
  for (const h of gardenStore.habits()) {
    const lv = gardenStore.live(h, today);
    if (!lv.dueToday && !lv.todayDone) continue;
    due++;
    if (!lv.todayDone) return false;
  }
  return due > 0;
}

/**
 * Marking a habit done, with what comes after it: a small moment on the
 * plant, a sound, a buzz. Marking one undone always offers Undo, so a stray
 * tap is never a lost day. Moments are counters a plot watches to replay.
 */
export function useGardenActions() {
  const { state, showToast } = useApp();
  // the same "today" every habit screen draws with, even in the minute after midnight
  const today = state.today;
  const [moments, setMoments] = useState<Moments>({});
  // the moment the last habit of the day is done
  const [celebrate, setCelebrate] = useState(0);

  const bump = useCallback((id: string, kind: "water" | "burst") => {
    setMoments((m) => {
      const cur = m[id] ?? { water: 0, burst: 0 };
      return { ...m, [id]: { ...cur, [kind]: cur[kind] + 1 } };
    });
  }, []);

  const water = useCallback(
    async (habit: HabitView, opts: { date?: string; step?: 1 | -1; fill?: boolean } = {}): Promise<void> => {
      const date = opts.date ?? today;
      const log = gardenStore.logs(habit.id).get(date);
      let change: { delta?: number; count?: number };
      if (opts.fill) {
        // a day marked after the fact is a whole day: all eight glasses, not one
        change = { count: Math.max(habit.target, log?.count ?? 0) };
      } else if (habit.target === 1) {
        change = { count: log?.done && opts.step !== 1 ? 0 : 1 };
      } else {
        if (opts.step === -1 && !(log?.count ?? 0)) return;
        change = { delta: opts.step ?? 1 };
      }
      const wasDone = Boolean(log?.done);
      const wasAll = date === today && allDueDone(today);
      const adding = (change.count ?? 1) > 0 && (change.delta ?? 1) > 0;
      if (adding) {
        bump(habit.id, "water");
        plink(false);
        buzz(12);
      }
      const r = await gardenStore.water(habit.id, date, change);
      if (!r.ok) {
        showToast({ message: r.kind === "offline" ? "You're offline, so that didn't save. Try again when you're back." : r.kind === "invalid" ? r.message : "Couldn't save that just now." });
        return;
      }
      const nowDone = Boolean(gardenStore.logs(habit.id).get(date)?.done);
      if (!wasDone && nowDone) {
        track("habit-water");
        bump(habit.id, "burst");
        if (date !== today) {
          showToast({ message: `Yesterday's marked done. Your ${r.data.events.streak}-${habit.schedule.kind === "weekly" ? "week" : "day"} streak carries on.` });
        } else if (!wasAll && allDueDone(today)) {
          setCelebrate((n) => n + 1);
          plink(true);
          buzz([16, 60, 24]);
          showToast({ message: "Everything's done today. Your garden is in full bloom." });
        }
      } else if (wasDone && !nowDone) {
        // taking a day back is allowed, and never silent: Undo puts back exactly what was there
        const before = log?.count ?? habit.target;
        showToast({
          message: `${habit.name} unmarked for ${date === today ? "today" : "yesterday"}.`,
          action: { label: "Undo", run: () => void gardenStore.water(habit.id, date, { count: before }) },
        });
      }
    },
    [bump, showToast, today]
  );

  const compost = useCallback(
    async (habit: HabitView, archived: boolean) => {
      const r = await gardenApi.archive(habit.id, archived);
      if (!r.ok) {
        showToast({ message: r.kind === "invalid" ? r.message : "Couldn't do that just now." });
        return false;
      }
      gardenStore.put(r.data.habit);
      showToast(
        archived
          ? { message: `${habit.name} is archived.`, action: { label: "Undo", run: () => void restore(habit.id) } }
          : { message: `${habit.name} is back on your list.` }
      );
      return true;
    },
    [showToast]
  );

  /** Deletes a habit and every day marked for it. An active habit is archived on the way, as the server asks. */
  const remove = useCallback(
    async (habit: HabitView) => {
      if (!habit.archivedAt) {
        const a = await gardenApi.archive(habit.id, true);
        if (!a.ok) {
          showToast({ message: a.kind === "offline" ? "You're offline, so that didn't delete. Try again when you're back." : "Couldn't delete that just now." });
          return false;
        }
        gardenStore.put(a.data.habit);
      }
      const r = await gardenApi.deleteForever(habit.id);
      if (!r.ok) {
        showToast({ message: r.kind === "invalid" ? r.message : "Couldn't delete that just now. It's in Archived for now." });
        return false;
      }
      gardenStore.remove(habit.id);
      track("habit-delete");
      showToast({ message: `${habit.name} is deleted.` });
      return true;
    },
    [showToast]
  );

  return { moments, celebrate, water, compost, remove, bump };
}

async function restore(id: string) {
  const r = await gardenApi.archive(id, false);
  if (r.ok) gardenStore.put(r.data.habit);
}
