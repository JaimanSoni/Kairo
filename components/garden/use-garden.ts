"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { gardenApi, gardenStore } from "@/lib/habits-client";
import {
  DROP_EVERY,
  fruitsEarned,
  goldenEarned,
  speciesOf,
  stageOf,
  type HabitView,
  type LiveHabit,
} from "@/lib/habits-shared";
import { track } from "@/lib/analytics-client";
import { useApp } from "../store";
import { buzz, plink } from "./fx";

/** The garden store, loaded once and kept fresh across midnight. */
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
  stage: ReturnType<typeof stageOf>;
  ripe: number;
  golden: number;
  thirsty: boolean;
};

export function plotOf(habit: HabitView, today: string): PlotInfo {
  const lv = gardenStore.live(habit, today);
  return {
    habit,
    live: lv,
    stage: stageOf(habit.growth),
    ripe: Math.max(0, fruitsEarned(habit.growth) - habit.harvested.fruit),
    golden: Math.max(0, goldenEarned(Math.max(lv.best, habit.settled.best)) - habit.harvested.golden),
    thirsty: lv.dueToday && !lv.todayDone,
  };
}

export type Moments = Record<string, { water: number; burst: number; golden: boolean }>;

/**
 * Watering, with everything that comes after it: the pour, the sound, the
 * buzz, and a sentence when something grew, ripened or a streak reached a
 * dew drop. Moments are counters a plot watches to replay its animation.
 */
export function useGardenActions() {
  const { state, showToast } = useApp();
  // the same "today" every garden screen draws with, even in the minute after midnight
  const today = state.today;
  const [moments, setMoments] = useState<Moments>({});

  const bump = useCallback((id: string, kind: "water" | "burst", golden = false) => {
    setMoments((m) => {
      const cur = m[id] ?? { water: 0, burst: 0, golden: false };
      return { ...m, [id]: { ...cur, [kind]: cur[kind] + 1, golden: kind === "burst" ? golden : cur.golden } };
    });
  }, []);

  const water = useCallback(
    async (habit: HabitView, opts: { date?: string; step?: 1 | -1; fill?: boolean } = {}) => {
      const date = opts.date ?? today;
      const log = gardenStore.logs(habit.id).get(date);
      // the journal plant is watered by writing; a stray tap shouldn't undo a page that was written
      if (habit.seedId === "journal" && habit.target === 1 && log?.done && !opts.step && !opts.fill) {
        showToast({ message: "📔 This one waters itself when you write in your journal." });
        return;
      }
      let change: { delta?: number; count?: number };
      if (opts.fill) {
        // a rescued day is a whole day: all eight glasses, not one
        change = { count: Math.max(habit.target, log?.count ?? 0) };
      } else if (habit.target === 1) {
        change = { count: log?.done && opts.step !== 1 ? 0 : 1 };
      } else {
        if (opts.step === -1 && !(log?.count ?? 0)) return;
        change = { delta: opts.step ?? 1 };
      }
      const wasDone = Boolean(log?.done);
      const adding = (change.count ?? 1) > 0 && (change.delta ?? 1) > 0;
      if (adding) {
        bump(habit.id, "water");
        plink(false);
        buzz(12);
      }
      const r = await gardenStore.water(habit.id, date, change);
      if (!r.ok) {
        showToast({ message: r.kind === "offline" ? "You're offline, so that didn't water. Try again when you're back." : r.kind === "invalid" ? r.message : "Couldn't water that just now." });
        return;
      }
      const after = gardenStore.logs(habit.id).get(date);
      const nowDone = Boolean(after?.done);
      const { events } = r.data;
      const species = speciesOf(habit.species);
      if (!wasDone && nowDone) {
        track("habit-water");
        if (events.golden) {
          bump(habit.id, "burst", true);
          plink(true);
          buzz([30, 40, 30, 40, 60]);
          showToast({ message: `✨ A golden fruit ripened on ${habit.emoji} ${habit.name}. Tap it to pick.` });
        } else if (events.grew) {
          bump(habit.id, "burst");
          plink(true);
          buzz([20, 30, 40]);
          const grown = stageOf(gardenStore.get(habit.id)?.growth ?? habit.growth + 1);
          showToast({ message: `🌱 ${habit.name} grew: it's ${stagePhrase(grown.label)} now.` });
        } else if (events.ripened) {
          bump(habit.id, "burst");
          plink(true);
          showToast({ message: `${species.fruitEmoji} A ${species.fruit.toLowerCase()} is ripe on ${habit.name}. Tap it to pick.` });
        } else if (events.streak > 0 && events.streak % DROP_EVERY === 0) {
          bump(habit.id, "burst");
          showToast({ message: `🔥 ${events.streak} days in a row. You earned a dew drop 💧 — it covers a day you miss.` });
        } else if (date !== today) {
          showToast({ message: `Yesterday's watered. Your ${events.streak}-day streak is safe.` });
        }
      }
    },
    [bump, showToast, today]
  );

  const pick = useCallback(
    async (habit: HabitView, kind: "fruit" | "golden") => {
      const r = await gardenApi.harvest(habit.id, kind);
      if (!r.ok) {
        showToast({ message: r.kind === "invalid" ? r.message : "Couldn't pick that just now." });
        return;
      }
      gardenStore.put(r.data.habit);
      bump(habit.id, "burst", kind === "golden");
      plink(true);
      buzz([15, 25, 15]);
      track("habit-harvest", { kind });
      const species = speciesOf(habit.species);
      showToast({ message: kind === "golden" ? "✨ A golden fruit, into the basket." : `${species.fruitEmoji} Picked a ${species.fruit.toLowerCase()}. It's in your basket.` });
    },
    [bump, showToast]
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
          ? { message: `${habit.emoji} ${habit.name} went to the compost.`, action: { label: "Undo", run: () => void compostBack(habit.id) } }
          : { message: `${habit.emoji} ${habit.name} is growing again.` }
      );
      return true;
    },
    [showToast]
  );

  return { moments, water, pick, compost, bump };
}

async function compostBack(id: string) {
  const r = await gardenApi.archive(id, false);
  if (r.ok) gardenStore.put(r.data.habit);
}

function stagePhrase(label: string): string {
  if (label === "In bloom") return "in bloom";
  if (label === "Bearing fruit") return "bearing fruit";
  return /^[aeiou]/i.test(label) ? `an ${label.toLowerCase()}` : `a ${label.toLowerCase()}`;
}
