"use client";

import {
  live,
  type Board,
  type City,
  type CityGarden,
  type CityScope,
  type Gardener,
  type HabitLogView,
  type HabitView,
  type LiveHabit,
  type LogLite,
  type SeedStat,
} from "./habits-shared";
import { todayStr } from "./dates";

/**
 * The browser's side of the garden: calls to the API, and one store every
 * screen reads — the garden, the Today strip, a plant's page — so a plant
 * watered in one place is watered everywhere at once.
 */

export type GardenFail =
  | { ok: false; kind: "missing" }
  | { ok: false; kind: "offline" }
  | { ok: false; kind: "invalid"; message: string }
  | { ok: false; kind: "error"; message: string };

export type GardenResult<T> = { ok: true; data: T } | GardenFail;

async function call<T>(url: string, init?: RequestInit): Promise<GardenResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers } });
  } catch {
    return { ok: false, kind: "offline" };
  }
  let body: Record<string, unknown> = {};
  try {
    body = await res.json();
  } catch {
    /* status alone will do */
  }
  if (res.ok) return { ok: true, data: body as T };
  const message = typeof body.error === "string" ? body.error : "Something went wrong.";
  if (res.status === 404) return { ok: false, kind: "missing" };
  if (res.status >= 400 && res.status < 500) return { ok: false, kind: "invalid", message };
  return { ok: false, kind: "error", message };
}

const zone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
};

export type WaterEvents = { grew: boolean; ripened: boolean; golden: boolean; streak: number };
export type HabitDraft = Partial<Pick<HabitView, "name" | "emoji" | "species" | "color" | "schedule" | "target" | "unit" | "reminder" | "why">> & { seedId?: string | null };

export const gardenApi = {
  load: (today = todayStr()) =>
    call<{ habits: HabitView[]; archived: HabitView[]; logs: HabitLogView[]; gardener: Gardener | null; nudges: boolean; cheers?: { today: number; from: string[] } }>(`/api/habits?today=${today}`),
  setNudges: (on: boolean) => call<{ on: boolean }>("/api/garden/nudges", { method: "PUT", body: JSON.stringify({ on, timezone: zone() }) }),
  plant: (draft: HabitDraft) =>
    call<{ habit: HabitView }>("/api/habits", { method: "POST", body: JSON.stringify({ ...draft, today: todayStr(), timezone: zone() }) }),
  update: (id: string, patch: HabitDraft & { order?: number }) =>
    call<{ habit: HabitView }>(`/api/habits/${id}`, { method: "PATCH", body: JSON.stringify({ ...patch, today: todayStr(), timezone: zone() }) }),
  archive: (id: string, archived: boolean) =>
    call<{ habit: HabitView }>(`/api/habits/${id}`, { method: "PATCH", body: JSON.stringify({ archived }) }),
  deleteForever: (id: string) => call<{ ok: true }>(`/api/habits/${id}`, { method: "DELETE" }),
  water: (id: string, input: { date: string; delta?: number; count?: number }) =>
    call<{ habit: HabitView; logs: HabitLogView[]; events: WaterEvents }>(`/api/habits/${id}/log`, {
      method: "POST",
      body: JSON.stringify({ ...input, today: todayStr() }),
    }),
  history: (id: string, from: string, to: string) => call<{ logs: HabitLogView[] }>(`/api/habits/${id}/history?from=${from}&to=${to}`),
  seeds: () => call<{ stats: SeedStat[] }>("/api/garden/seeds"),
  board: (seed: string, scope: "global" | "friends") => call<Board>(`/api/garden/board?seed=${seed}&scope=${scope}&today=${todayStr()}`),
  profile: () => call<{ gardener: Gardener | null }>("/api/garden/profile"),
  setProfile: (g: Gardener) => call<{ gardener: Gardener }>("/api/garden/profile", { method: "PUT", body: JSON.stringify(g) }),
  city: (scope: CityScope) => call<City>(`/api/garden/city?scope=${scope}&today=${todayStr()}`),
  visit: (id: string) => call<{ garden: CityGarden }>(`/api/garden/city/${id}?today=${todayStr()}`),
  cheer: (id: string) => call<{ cheers: CityGarden["cheers"] }>(`/api/garden/city/${id}/cheer`, { method: "POST", body: JSON.stringify({ today: todayStr() }) }),
};

/* ----------------------------------------------------------------- store */

type GardenState = {
  status: "idle" | "loading" | "ready" | "error";
  habits: HabitView[];
  archived: HabitView[];
  logs: Map<string, Map<string, LogLite>>;
  gardener: Gardener | null;
  nudges: boolean;
  /** Cheers your garden got today in Kairo City. */
  cheers: { today: number; from: string[] };
  tick: number;
};

const garden: GardenState = { status: "idle", habits: [], archived: [], logs: new Map(), gardener: null, nudges: true, cheers: { today: 0, from: [] }, tick: 0 };
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;
let owner: string | null = null;
let generation = 0;
/** Bumped by every local change, so a load that crossed paths with one is never applied over it. */
let changes = 0;
const inFlight = new Map<string, number>();

if (typeof window !== "undefined") {
  // something outside the garden watered a plant (a journal page): the next look reloads
  window.addEventListener("kairo:garden-stale", () => {
    loadedAt = 0;
    // a garden already on screen (the Today strip, the thirsty dot) catches up now, not on its next visit
    if (garden.status === "ready" && listeners.size > 0) void gardenStore.reload();
  });
}
let loadedDay = "";
let loadedAt = 0;

function emit() {
  garden.tick++;
  for (const l of listeners) l();
}

function logsFor(habitId: string): Map<string, LogLite> {
  let map = garden.logs.get(habitId);
  if (!map) {
    map = new Map();
    garden.logs.set(habitId, map);
  }
  return map;
}

export const gardenStore = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  snapshot: () => garden.tick,
  status: () => garden.status,
  habits: () => garden.habits,
  archived: () => garden.archived,
  gardener: () => garden.gardener,
  nudges: () => garden.nudges,
  cheers: () => garden.cheers,
  get: (id: string) => garden.habits.find((h) => h.id === id) ?? garden.archived.find((h) => h.id === id) ?? null,
  logs: (id: string) => logsFor(id),

  /** The plant as it stands today, computed by the same rules the server settles with. */
  live(habit: HabitView, today = todayStr()): LiveHabit {
    return live({ schedule: habit.schedule, startDate: habit.startDate }, logsFor(habit.id), habit.settled, today);
  },

  /** A different account in the same tab never sees the last one's garden, even for a frame. */
  forUser(userId: string | undefined) {
    const id = userId ?? null;
    if (owner === id) return;
    owner = id;
    if (garden.status !== "idle") gardenStore.reset();
  },

  ensureLoaded(): Promise<void> {
    return garden.status === "ready" ? Promise.resolve() : gardenStore.reload();
  },

  /** Loads when needed: first visit, a new day, or data older than half a minute (another device may have watered). */
  refresh(today = todayStr()): Promise<void> {
    if (garden.status === "ready" && loadedDay === today && Date.now() - loadedAt < 30_000) return Promise.resolve();
    return gardenStore.reload();
  },

  reload(): Promise<void> {
    if (loading) return loading;
    const run: Promise<void> = (async () => {
      const gen = generation;
      if (garden.status !== "ready") {
        garden.status = "loading";
        emit();
      }
      const day = todayStr();
      let r: Awaited<ReturnType<typeof gardenApi.load>> | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const before = changes;
        r = await gardenApi.load(day);
        // signed out, or into another account, while this was on its way
        if (gen !== generation) return;
        // something was watered while this was loading: the answer predates it, so ask again
        if (changes === before || garden.status !== "ready") break;
        if (attempt === 2) return;
      }
      if (!r) return;
      if (r.ok) {
        loadedDay = day;
        loadedAt = Date.now();
        garden.habits = r.data.habits;
        garden.archived = r.data.archived;
        garden.gardener = r.data.gardener;
        garden.nudges = r.data.nudges !== false;
        garden.cheers = r.data.cheers ?? { today: 0, from: [] };
        garden.logs = new Map();
        for (const l of r.data.logs) logsFor(l.habitId).set(l.date, { date: l.date, count: l.count, done: l.done, frozen: l.frozen });
        garden.status = "ready";
      } else if (garden.status !== "ready") {
        garden.status = "error";
      }
      emit();
    })().finally(() => {
      if (loading === run) loading = null;
    });
    loading = run;
    return run;
  },

  put(habit: HabitView, logs?: HabitLogView[]) {
    changes++;
    garden.habits = garden.habits.filter((h) => h.id !== habit.id);
    garden.archived = garden.archived.filter((h) => h.id !== habit.id);
    if (habit.archivedAt) garden.archived = [habit, ...garden.archived];
    else garden.habits = [...garden.habits, habit].sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
    if (logs) {
      const map = logsFor(habit.id);
      for (const l of logs) map.set(l.date, { date: l.date, count: l.count, done: l.done, frozen: l.frozen });
    }
    emit();
  },

  remove(id: string) {
    garden.habits = garden.habits.filter((h) => h.id !== id);
    garden.archived = garden.archived.filter((h) => h.id !== id);
    garden.logs.delete(id);
    emit();
  },

  setGardener(g: Gardener | null) {
    garden.gardener = g;
    emit();
  },

  async setNudges(on: boolean): Promise<boolean> {
    const before = garden.nudges;
    garden.nudges = on;
    emit();
    const r = await gardenApi.setNudges(on);
    if (!r.ok) {
      garden.nudges = before;
      emit();
      return false;
    }
    return true;
  },

  /**
   * Waters at once on screen, then asks the server. The server's answer
   * replaces the guess; a refusal puts the day back as it was.
   */
  async water(habitId: string, date: string, change: { delta?: number; count?: number }): Promise<GardenResult<{ events: WaterEvents }>> {
    const habit = garden.habits.find((h) => h.id === habitId);
    if (!habit) return { ok: false, kind: "missing" };
    const map = logsFor(habitId);
    const before = map.get(date);
    const count = Math.max(0, change.count ?? (before?.count ?? 0) + (change.delta ?? 0));
    changes++;
    map.set(date, { date, count, done: count >= habit.target, frozen: before?.frozen ?? false });
    emit();
    inFlight.set(habitId, (inFlight.get(habitId) ?? 0) + 1);
    const r = await gardenApi.water(habitId, { date, ...change });
    const still = (inFlight.get(habitId) ?? 1) - 1;
    if (still > 0) inFlight.set(habitId, still);
    else inFlight.delete(habitId);
    if (!r.ok) {
      if (still === 0) {
        if (before) map.set(date, before);
        else map.delete(date);
      }
      emit();
      // a quick run of taps that ended in a refusal: let the server say where things stand
      if (still === 0) void gardenStore.reload();
      return r;
    }
    // with more taps on their way, their answers will be newer than this one
    if (still === 0) gardenStore.put(r.data.habit, r.data.logs);
    return { ok: true, data: { events: r.data.events } };
  },

  reset() {
    generation++;
    loading = null;
    loadedDay = "";
    garden.status = "idle";
    garden.habits = [];
    garden.archived = [];
    garden.logs = new Map();
    garden.gardener = null;
    emit();
  },
};
