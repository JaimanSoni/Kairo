/**
 * The garden's rules: how a habit is scheduled, how a streak holds, how a
 * plant grows and when it bears fruit. Shared by the server, the browser, the
 * assistant tools and the tests.
 *
 * Pure on purpose — no database, no DOM, no path aliases — so the streak you
 * see is computed by exactly the code the server settles it with.
 *
 * One principle shapes every rule here: a plant can wilt, but it never dies.
 * Growth is permanent, dew drops cover a missed day, and an unwatered plant
 * springs back the moment it's watered. The pull to come back is real; the
 * punishment for having been away is not.
 */

/* ---------------------------------------------------------------- dates */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(v: unknown): v is string {
  if (typeof v !== "string" || !DATE_RE.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  if (y < 2000 || y > 2200 || m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Weeks run Monday to Sunday; a week is named by its Monday. */
export function mondayOf(date: string): string {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

export function daysBetween(from: string, to: string): number {
  const [a, b, c] = from.split("-").map(Number);
  const [x, y, z] = to.split("-").map(Number);
  return Math.round((Date.UTC(x, y - 1, z) - Date.UTC(a, b - 1, c)) / 86_400_000);
}

export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ------------------------------------------------------------- schedule */

export type HabitSchedule =
  | { kind: "daily" }
  /** Specific weekdays, 0 = Sunday. */
  | { kind: "days"; days: number[] }
  /** Any days, so long as it happens this many times in a Monday-to-Sunday week. */
  | { kind: "weekly"; times: number };

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function cleanSchedule(v: unknown): HabitSchedule | null {
  if (typeof v !== "object" || v === null) return null;
  const s = v as Record<string, unknown>;
  if (s.kind === "daily") return { kind: "daily" };
  if (s.kind === "days" && Array.isArray(s.days)) {
    const days = [...new Set(s.days)].filter((d): d is number => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6);
    if (days.length === 0) return null;
    if (days.length === 7) return { kind: "daily" };
    return { kind: "days", days: days.sort((a, b) => a - b) };
  }
  if (s.kind === "weekly" && Number.isInteger(s.times) && (s.times as number) >= 1 && (s.times as number) <= 7) {
    return (s.times as number) === 7 ? { kind: "daily" } : { kind: "weekly", times: s.times as number };
  }
  return null;
}

export function scheduleLabel(s: HabitSchedule): string {
  if (s.kind === "daily") return "Every day";
  if (s.kind === "weekly") return s.times === 1 ? "Once a week" : `${s.times} times a week`;
  if (s.days.join() === "1,2,3,4,5") return "Weekdays";
  if (s.days.join() === "0,6") return "Weekends";
  return s.days.map((d) => WEEKDAY_SHORT[d]).join(", ");
}

/** Whether a day is one the habit asks for. A weekly habit can happen on any day. */
export function isScheduledDay(s: HabitSchedule, date: string): boolean {
  return s.kind === "days" ? s.days.includes(weekdayOf(date)) : true;
}

/* -------------------------------------------------------------- species */

export const SPECIES = [
  { id: "sunflower", label: "Sunflower", fruit: "Sunflower seeds", fruitEmoji: "🌻" },
  { id: "tulip", label: "Tulip", fruit: "Tulip bulb", fruitEmoji: "🌷" },
  { id: "lavender", label: "Lavender", fruit: "Lavender sprig", fruitEmoji: "💜" },
  { id: "rose", label: "Rose", fruit: "Rose hip", fruitEmoji: "🌹" },
  { id: "cactus", label: "Cactus", fruit: "Prickly pear", fruitEmoji: "🌵" },
  { id: "bonsai", label: "Bonsai", fruit: "Pine cone", fruitEmoji: "🌲" },
  { id: "apple", label: "Apple tree", fruit: "Apple", fruitEmoji: "🍎" },
  { id: "lemon", label: "Lemon tree", fruit: "Lemon", fruitEmoji: "🍋" },
  { id: "strawberry", label: "Strawberry", fruit: "Strawberry", fruitEmoji: "🍓" },
  { id: "cherry", label: "Cherry blossom", fruit: "Cherries", fruitEmoji: "🍒" },
  { id: "monstera", label: "Monstera", fruit: "Monstera fruit", fruitEmoji: "🌿" },
  { id: "lotus", label: "Lotus", fruit: "Lotus pod", fruitEmoji: "🪷" },
] as const;

export type SpeciesId = (typeof SPECIES)[number]["id"];

export const isSpecies = (v: unknown): v is SpeciesId => SPECIES.some((s) => s.id === v);
export const speciesOf = (id: string) => SPECIES.find((s) => s.id === id) ?? SPECIES[0];

/* ---------------------------------------------------------------- growth */

export const STAGES = [
  { id: "seed", label: "Seed", min: 0 },
  { id: "sprout", label: "Sprout", min: 1 },
  { id: "seedling", label: "Seedling", min: 3 },
  { id: "young", label: "Young plant", min: 7 },
  { id: "mature", label: "Mature", min: 14 },
  { id: "blooming", label: "In bloom", min: 21 },
  { id: "fruiting", label: "Bearing fruit", min: 30 },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

/** Where a plant is, from how many times it has ever been watered. Growth never goes backwards. */
export function stageOf(growth: number) {
  let index = 0;
  for (let i = 0; i < STAGES.length; i++) if (growth >= STAGES[i].min) index = i;
  const next = STAGES[index + 1] ?? null;
  const from = STAGES[index].min;
  return {
    index,
    id: STAGES[index].id as StageId,
    label: STAGES[index].label as string,
    next: next ? { label: next.label as string, at: next.min, left: next.min - growth } : null,
    progress: next ? Math.min(1, (growth - from) / (next.min - from)) : 1,
  };
}

/** Fruits ripen as waterings add up; they're never lost. */
const GROWTH_FRUITS = [7, 14, 21, 30, 45, 60, 80, 100];
/** Golden fruits ripen on a plant's best-ever streak — also never lost. */
export const GOLDEN_STREAKS = [21, 66, 100, 200, 365];

export function fruitsEarned(growth: number): number {
  const listed = GROWTH_FRUITS.filter((m) => growth >= m).length;
  return growth > 100 ? listed + Math.floor((growth - 100) / 25) : listed;
}

export function goldenEarned(best: number): number {
  return GOLDEN_STREAKS.filter((m) => best >= m).length;
}

export function nextFruitAt(growth: number): number {
  const listed = GROWTH_FRUITS.find((m) => m > growth);
  if (listed !== undefined) return listed;
  return 100 + (Math.floor((growth - 100) / 25) + 1) * 25;
}

export function nextGoldenAt(best: number): number | null {
  return GOLDEN_STREAKS.find((m) => m > best) ?? null;
}

/* -------------------------------------------------------------- streaks */

/** A dew drop is earned every this many periods in a row. */
export const DROP_EVERY = 7;
export const MAX_DROPS = 3;

export type LogLite = { date: string; count: number; done: boolean; frozen?: boolean };

/** What's been decided for good: every period up to `through`. */
export type Settled = {
  /** The last finalized period (a day, or a week's Monday); null before anything is final. */
  through: string | null;
  streak: number;
  best: number;
  drops: number;
};

export const FRESH_SETTLED: Settled = { through: null, streak: 0, best: 0, drops: 0 };

type Habitish = { schedule: HabitSchedule; startDate: string };

function periodDone(h: Habitish, logs: Map<string, LogLite>, key: string): boolean {
  if (h.schedule.kind !== "weekly") return Boolean(logs.get(key)?.done);
  let done = 0;
  for (let i = 0; i < 7; i++) if (logs.get(addDays(key, i))?.done) done++;
  return done >= h.schedule.times;
}

/** The current period for a day: the day itself, or its week's Monday. */
export function periodOf(s: HabitSchedule, date: string): string {
  return s.kind === "weekly" ? mondayOf(date) : date;
}

/**
 * The last period that can no longer change. A day stays open through the
 * next day, so yesterday can still be watered; a week stays open one day past
 * its Sunday.
 */
export function finalThrough(s: HabitSchedule, today: string): string {
  return s.kind === "weekly" ? mondayOf(addDays(today, -8)) : addDays(today, -2);
}

/** Periods after `after` (exclusive) up to `upTo` (inclusive), in order. */
function periods(h: Habitish, after: string | null, upTo: string): string[] {
  const out: string[] = [];
  if (h.schedule.kind === "weekly") {
    let m = after ? addDays(after, 7) : mondayOf(h.startDate);
    for (let guard = 0; m <= upTo && guard < 2000; guard++, m = addDays(m, 7)) out.push(m);
    return out;
  }
  let d = after ? addDays(after, 1) : h.startDate;
  if (d < h.startDate) d = h.startDate;
  for (let guard = 0; d <= upTo && guard < 5000; guard++, d = addDays(d, 1)) {
    if (isScheduledDay(h.schedule, d)) out.push(d);
  }
  return out;
}

type Step = { state: Settled; freezes: string[] };

/** One period's verdict. `open` periods can still be done, so a miss there changes nothing yet. */
function step(h: Habitish, logs: Map<string, LogLite>, s: Settled, key: string, open: boolean, freezes: string[]): Settled {
  const next = { ...s, through: open ? s.through : key };
  if (periodDone(h, logs, key)) {
    next.streak = s.streak + 1;
    next.best = Math.max(s.best, next.streak);
    if (next.streak % DROP_EVERY === 0) next.drops = Math.min(MAX_DROPS, s.drops + 1);
    return next;
  }
  if (open) return next;
  // a plant's first week can't be failed: it may have been planted on a Saturday
  if (h.schedule.kind === "weekly" && key === mondayOf(h.startDate)) return next;
  if (logs.get(key)?.frozen) return next;
  if (s.drops > 0) {
    next.drops = s.drops - 1;
    freezes.push(key);
    return next;
  }
  next.streak = 0;
  return next;
}

/**
 * Settles every period that can no longer change. Deterministic: the same
 * logs always settle the same way. Returns the periods that a dew drop covered,
 * which the server records so the drop is spent exactly once.
 */
export function settle(h: Habitish, logs: Map<string, LogLite>, from: Settled, today: string): Step {
  const upTo = finalThrough(h.schedule, today);
  const freezes: string[] = [];
  let state = from;
  for (const key of periods(h, from.through, upTo)) state = step(h, logs, state, key, false, freezes);
  return { state, freezes };
}

export type Health = "thriving" | "healthy" | "thirsty" | "wilted";

export type LiveHabit = {
  streak: number;
  best: number;
  drops: number;
  /** Whether the habit asks for something today (for a weekly habit: this week isn't met yet). */
  dueToday: boolean;
  todayCount: number;
  todayDone: boolean;
  /** For a weekly habit: done days this week, of how many. */
  week: { done: number; times: number } | null;
  /**
   * An open, unwatered period in the past — yesterday, or last week — that is
   * still in time to water. `keeps` is the streak it would save.
   */
  rescue: { key: string; keeps: number; covered: boolean } | null;
  health: Health;
};

/**
 * The habit as it stands now: the settled state carried through the periods
 * still open, without committing anything. What the garden shows.
 */
export function live(h: Habitish, logs: Map<string, LogLite>, settled: Settled, today: string): LiveHabit {
  const current = periodOf(h.schedule, today);
  const freezes: string[] = [];
  let state = settle(h, logs, settled, today).state;
  let rescue: LiveHabit["rescue"] = null;

  for (const key of periods(h, state.through, current)) {
    if (key === current) {
      state = step(h, logs, state, key, true, freezes);
      continue;
    }
    // an open past period: done counts, a miss is still rescuable
    if (periodDone(h, logs, key)) {
      state = step(h, logs, state, key, true, freezes);
    } else if (h.schedule.kind === "weekly" && key === mondayOf(h.startDate)) {
      // the week it was planted can't be failed, so there's nothing to rescue
    } else if (!logs.get(key)?.frozen) {
      const covered = state.drops > 0;
      rescue = { key, keeps: state.streak, covered };
      if (covered) state = { ...state, drops: state.drops - 1 };
      else state = { ...state, streak: 0 };
    }
  }

  const todayLog = logs.get(today);
  let week: LiveHabit["week"] = null;
  let dueToday: boolean;
  if (h.schedule.kind === "weekly") {
    let done = 0;
    for (let i = 0; i < 7; i++) if (logs.get(addDays(current, i))?.done) done++;
    week = { done, times: h.schedule.times };
    dueToday = done < h.schedule.times;
  } else {
    dueToday = isScheduledDay(h.schedule, today) && today >= h.startDate;
  }

  return {
    streak: state.streak,
    best: Math.max(state.best, settled.best),
    drops: state.drops,
    dueToday,
    todayCount: todayLog?.count ?? 0,
    todayDone: Boolean(todayLog?.done),
    week,
    rescue,
    health: healthOf(h, logs, today),
  };
}

/** How a plant looks: the last week of scheduled days (the last two weeks, for a weekly habit). */
export function healthOf(h: Habitish, logs: Map<string, LogLite>, today: string): Health {
  let asked = 0;
  let kept = 0;
  if (h.schedule.kind === "weekly") {
    for (const m of [mondayOf(addDays(today, -7)), mondayOf(today)]) {
      if (addDays(m, 6) < h.startDate) continue;
      let done = 0;
      for (let i = 0; i < 7; i++) if (logs.get(addDays(m, i))?.done) done++;
      const isCurrent = m === mondayOf(today);
      // this week only counts for as much of it as has passed
      const need = isCurrent ? Math.min(h.schedule.times, Math.max(1, Math.round((h.schedule.times * (daysBetween(m, today) + 1)) / 7))) : h.schedule.times;
      asked += need;
      kept += Math.min(done, need) + (logs.get(m)?.frozen ? need * 0.5 : 0);
    }
  } else {
    for (let i = 7; i >= 0; i--) {
      const d = addDays(today, -i);
      if (d < h.startDate || !isScheduledDay(h.schedule, d)) continue;
      const log = logs.get(d);
      // today only counts once it's done; an unwatered today is still in time
      if (i === 0 && !log?.done) continue;
      asked++;
      kept += log?.done ? 1 : log?.frozen ? 0.5 : 0;
    }
  }
  if (asked === 0) return "healthy";
  const ratio = kept / asked;
  return ratio >= 0.85 ? "thriving" : ratio >= 0.55 ? "healthy" : ratio >= 0.25 ? "thirsty" : "wilted";
}

/**
 * A streak for a leaderboard, where the server has only the snapshot taken at
 * the last watering. A streak whose last watering is further back than a miss
 * plus the dew drops on hand could cover is shown as broken, not as frozen in
 * time at its peak.
 */
export function effectiveStreak(streak: number, lastDone: string | null, drops: number, schedule: HabitSchedule, today: string): number {
  if (!lastDone || streak <= 0) return 0;
  const gap = daysBetween(lastDone, today);
  const allowed = schedule.kind === "weekly" ? 14 + drops * 7 : schedule.kind === "days" ? 8 + drops * 7 : 2 + drops;
  return gap <= allowed ? streak : 0;
}

/* ------------------------------------------------------------- cleaning */

export const PALETTE = ["sun", "amber", "rose", "lilac", "sky", "moss"] as const;
export type HabitColor = (typeof PALETTE)[number];
export const isHabitColor = (v: unknown): v is HabitColor => PALETTE.includes(v as HabitColor);

export const HABIT_NAME_MAX = 60;
export const MAX_HABITS = 40;

export function cleanHabitName(v: unknown): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, HABIT_NAME_MAX) : "";
}

export function cleanShort(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export function cleanReminder(v: unknown): string | null {
  return typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null;
}

export function cleanEmoji(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s.length > 16 || /[\s<>]/.test(s)) return null;
  return /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(s) ? s : null;
}

/** A gardener's public name: letters, numbers, spaces and a little punctuation. */
export function cleanGardenerName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  if (s.length < 2 || s.length > 24) return null;
  return /^[\p{L}\p{N} ._'-]+$/u.test(s) ? s : null;
}

export const ANIMALS = ["1", "2", "3", "4", "5", "6"] as const;
export const isAnimal = (v: unknown): v is (typeof ANIMALS)[number] => ANIMALS.includes(v as (typeof ANIMALS)[number]);

/* ---------------------------------------------------------------- seeds */

export type SeedCategory = "health" | "mind" | "learn" | "work" | "home" | "kairo";

export const SEED_CATEGORIES: { id: SeedCategory; label: string }[] = [
  { id: "health", label: "Body" },
  { id: "mind", label: "Mind" },
  { id: "learn", label: "Learn" },
  { id: "work", label: "Work" },
  { id: "home", label: "Home & people" },
  { id: "kairo", label: "With Kairo" },
];

export type Seed = {
  id: string;
  name: string;
  emoji: string;
  species: SpeciesId;
  color: HabitColor;
  category: SeedCategory;
  schedule: HabitSchedule;
  target: number;
  unit: string;
  hint: string;
  why: string;
};

/**
 * The seed catalogue: popular habits, each with a species that suits it. A
 * habit planted from a seed keeps its id, which is what lets gardeners growing
 * the same thing find each other on a leaderboard.
 */
export const SEEDS: Seed[] = [
  { id: "water", name: "Drink water", emoji: "💧", species: "lotus", color: "sky", category: "health", schedule: { kind: "daily" }, target: 8, unit: "glasses", hint: "Eight glasses, one tap each", why: "I take care of my body" },
  { id: "walk", name: "Go for a walk", emoji: "🚶", species: "sunflower", color: "amber", category: "health", schedule: { kind: "daily" }, target: 1, unit: "", hint: "Even ten minutes counts", why: "I move every day" },
  { id: "workout", name: "Work out", emoji: "💪", species: "apple", color: "rose", category: "health", schedule: { kind: "weekly", times: 3 }, target: 1, unit: "", hint: "Three times a week", why: "I'm getting stronger" },
  { id: "stretch", name: "Stretch", emoji: "🧘", species: "lavender", color: "lilac", category: "health", schedule: { kind: "daily" }, target: 1, unit: "", hint: "Five minutes, morning or night", why: "I look after my body" },
  { id: "sleep", name: "In bed by 11", emoji: "🌙", species: "lotus", color: "lilac", category: "health", schedule: { kind: "daily" }, target: 1, unit: "", hint: "Protect tomorrow's energy", why: "I rest well" },
  { id: "veggies", name: "Eat vegetables", emoji: "🥦", species: "strawberry", color: "moss", category: "health", schedule: { kind: "daily" }, target: 1, unit: "", hint: "At least one proper serving", why: "I eat well" },
  { id: "meditate", name: "Meditate", emoji: "🪷", species: "bonsai", color: "sun", category: "mind", schedule: { kind: "daily" }, target: 1, unit: "", hint: "A few quiet minutes", why: "I have a calm mind" },
  { id: "gratitude", name: "Three good things", emoji: "🙏", species: "rose", color: "rose", category: "mind", schedule: { kind: "daily" }, target: 1, unit: "", hint: "Notice what went right", why: "I notice the good" },
  { id: "no-phone", name: "No phone first hour", emoji: "📵", species: "cactus", color: "amber", category: "mind", schedule: { kind: "daily" }, target: 1, unit: "", hint: "Start the day on your terms", why: "My mornings are mine" },
  { id: "read", name: "Read", emoji: "📚", species: "apple", color: "moss", category: "learn", schedule: { kind: "daily" }, target: 1, unit: "", hint: "Ten pages or ten minutes", why: "I'm a reader" },
  { id: "language", name: "Practise a language", emoji: "🗣️", species: "cherry", color: "rose", category: "learn", schedule: { kind: "daily" }, target: 1, unit: "", hint: "One lesson a day", why: "I'm becoming fluent" },
  { id: "code", name: "Code something", emoji: "💻", species: "monstera", color: "sky", category: "learn", schedule: { kind: "weekly", times: 5 }, target: 1, unit: "", hint: "Five days a week", why: "I build things" },
  { id: "deep-work", name: "Deep work block", emoji: "🎯", species: "lemon", color: "amber", category: "work", schedule: { kind: "days", days: [1, 2, 3, 4, 5] }, target: 1, unit: "", hint: "One focused block, weekdays", why: "I do my best work" },
  { id: "inbox-zero", name: "Clear the inbox", emoji: "📥", species: "tulip", color: "sky", category: "work", schedule: { kind: "days", days: [1, 2, 3, 4, 5] }, target: 1, unit: "", hint: "Weekdays, before you log off", why: "I stay on top of things" },
  { id: "tidy", name: "Tidy for 10 minutes", emoji: "🧹", species: "tulip", color: "lilac", category: "home", schedule: { kind: "daily" }, target: 1, unit: "", hint: "A little every day", why: "My space feels good" },
  { id: "call", name: "Call someone you love", emoji: "📞", species: "cherry", color: "rose", category: "home", schedule: { kind: "weekly", times: 2 }, target: 1, unit: "", hint: "Twice a week", why: "I stay close to my people" },
  { id: "plants", name: "Water real plants", emoji: "🪴", species: "monstera", color: "moss", category: "home", schedule: { kind: "weekly", times: 2 }, target: 1, unit: "", hint: "The ones on the windowsill", why: "I keep things alive" },
  { id: "journal", name: "Write in the journal", emoji: "📔", species: "cherry", color: "sun", category: "kairo", schedule: { kind: "daily" }, target: 1, unit: "", hint: "Waters itself when you write a page", why: "I reflect on my days" },
  { id: "plan", name: "Plan tomorrow", emoji: "🗓️", species: "sunflower", color: "sun", category: "kairo", schedule: { kind: "days", days: [0, 1, 2, 3, 4] }, target: 1, unit: "", hint: "Sunday to Thursday evenings", why: "I start each day ready" },
];

export const seedOf = (id: string | null | undefined) => (id ? SEEDS.find((s) => s.id === id) ?? null : null);

/* ----------------------------------------------------------------- types */

export type HabitView = {
  id: string;
  name: string;
  emoji: string;
  species: SpeciesId;
  color: HabitColor;
  seedId: string | null;
  schedule: HabitSchedule;
  target: number;
  unit: string;
  reminder: string | null;
  why: string;
  startDate: string;
  createdAt: string;
  archivedAt: string | null;
  order: number;
  growth: number;
  settled: Settled;
  harvested: { fruit: number; golden: number };
};

export type HabitLogView = { habitId: string; date: string; count: number; done: boolean; frozen: boolean };

export type Gardener = { name: string; animal: (typeof ANIMALS)[number]; public: boolean };

export type BoardRow = {
  rank: number;
  name: string;
  animal: string;
  streak: number;
  best: number;
  me: boolean;
};

export type Board = {
  seedId: string;
  scope: "global" | "friends";
  rows: BoardRow[];
  me: BoardRow | null;
  gardeners: number;
};

export type SeedStat = { seedId: string; gardeners: number; wateredToday: number };

export type Harvest = { id: string; habitName: string; species: SpeciesId; kind: "fruit" | "golden"; at: string };
