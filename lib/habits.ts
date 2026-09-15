import { ObjectId, type WithId } from "mongodb";
import { getDb, withDbRetry } from "./db";
import {
  addDays,
  cleanEmoji,
  cleanGardenerName,
  cleanHabitName,
  cleanReminder,
  cleanSchedule,
  cleanShort,
  effectiveStreak,
  FRESH_SETTLED,
  fruitsEarned,
  goldenEarned,
  isAnimal,
  isDateKey,
  isHabitColor,
  isSpecies,
  live,
  MAX_HABITS,
  seedOf,
  settle,
  stageOf,
  STRENGTH_WINDOW_DAYS,
  utcToday,
  type Board,
  type BoardRow,
  type Gardener,
  type Harvest,
  type HabitColor,
  type HabitLogView,
  type HabitSchedule,
  type HabitView,
  type LogLite,
  type SeedStat,
  type Settled,
  type SpeciesId,
} from "./habits-shared";
import { safeTimeZone, todayIn } from "./tz";

/**
 * The garden: habits, the days they were watered, and the fruit they bore.
 *
 * A habit keeps the settled part of its streak — every day that can no longer
 * change — and the days themselves live in habit_logs, one row per habit per
 * day under a unique index. Everything else (today's streak, whether yesterday
 * is still rescuable, how healthy the plant looks) is derived from those two by
 * the same pure rules the browser uses, so the server and the screen can't
 * disagree about a streak.
 */

export type HabitRecord = {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  emoji: string;
  species: SpeciesId;
  color: HabitColor;
  seedId: string | null;
  schedule: HabitSchedule;
  target: number;
  unit: string;
  reminder: string | null;
  /** The zone the reminder fires in, from the browser that set it. */
  timezone: string;
  why: string;
  /** The local day it was planted: nothing before it can count against it. */
  startDate: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  order: number;
  /** Days ever watered in full. Growth never goes backwards. */
  growth: number;
  settled: Settled;
  harvested: { fruit: number; golden: number };
  /** The streak as of the last watering, for leaderboards that can't read every log. */
  board: { streak: number; best: number; drops: number; lastDone: string | null };
  /** Bumped on every settle, so two settles can't both spend the same dew drop. */
  rev: number;
};

export type LogRecord = {
  _id: ObjectId;
  userId: ObjectId;
  habitId: ObjectId;
  seedId: string | null;
  date: string;
  count: number;
  done: boolean;
  /** A missed day a dew drop covered. */
  frozen: boolean;
  at: Date;
};

type HarvestRecord = {
  _id: ObjectId;
  userId: ObjectId;
  habitId: ObjectId;
  habitName: string;
  species: SpeciesId;
  kind: "fruit" | "golden";
  at: Date;
};

type GardenerRecord = { name: string; animal: string; public: boolean };

export async function habitsCollection() {
  return (await getDb()).collection<HabitRecord>("habits");
}
export async function logsCollection() {
  return (await getDb()).collection<LogRecord>("habit_logs");
}
async function harvestsCollection() {
  return (await getDb()).collection<HarvestRecord>("harvests");
}

let indexReady: Promise<unknown> | null = null;
export async function ensureHabitIndexes(): Promise<void> {
  indexReady ??= (async () => {
    const [habits, logs, harvests] = await Promise.all([habitsCollection(), logsCollection(), harvestsCollection()]);
    await Promise.all([
      habits.createIndex({ userId: 1, archivedAt: 1, order: 1 }, { name: "habits_by_user" }),
      habits.createIndex({ seedId: 1, archivedAt: 1 }, { name: "habits_by_seed" }),
      logs.createIndex({ habitId: 1, date: 1 }, { unique: true, name: "habit_log_day_unique" }),
      logs.createIndex({ userId: 1, date: 1 }, { name: "habit_logs_by_user" }),
      harvests.createIndex({ userId: 1, at: -1 }, { name: "harvests_by_user" }),
    ]);
  })().catch((err: unknown) => {
    indexReady = null;
    throw err;
  });
  await indexReady;
}

export class HabitInputError extends Error {}
const bad = (message: string): never => {
  throw new HabitInputError(message);
};

/** A local day a request may name: within a day of UTC's, which is every zone on Earth. */
export function isHabitToday(v: unknown): v is string {
  if (!isDateKey(v)) return false;
  const utc = utcToday();
  return v >= addDays(utc, -1) && v <= addDays(utc, 1);
}

export function toHabitView(r: WithId<HabitRecord>): HabitView {
  return {
    id: r._id.toHexString(),
    name: r.name,
    emoji: r.emoji,
    species: r.species,
    color: r.color,
    seedId: r.seedId,
    schedule: r.schedule,
    target: r.target,
    unit: r.unit ?? "",
    reminder: r.reminder,
    why: r.why ?? "",
    startDate: r.startDate,
    createdAt: r.createdAt.toISOString(),
    archivedAt: r.archivedAt ? r.archivedAt.toISOString() : null,
    order: r.order ?? 0,
    growth: r.growth ?? 0,
    settled: r.settled ?? FRESH_SETTLED,
    harvested: r.harvested ?? { fruit: 0, golden: 0 },
  };
}

const toLogView = (l: LogRecord): HabitLogView => ({
  habitId: l.habitId.toHexString(),
  date: l.date,
  count: l.count,
  done: l.done,
  frozen: Boolean(l.frozen),
});

const toLite = (l: Pick<LogRecord, "date" | "count" | "done" | "frozen">): LogLite => ({
  date: l.date,
  count: l.count,
  done: l.done,
  frozen: Boolean(l.frozen),
});

/** How far back settling reads. A plant untouched for longer simply starts its streak afresh. */
const SETTLE_WINDOW_DAYS = 400;

/**
 * Brings a habit's settled streak up to date — spending dew drops on missed
 * days as it goes — and refreshes its leaderboard snapshot. The frozen day is
 * written before the state that spent the drop, and the state is written only
 * if nobody settled in between, so a drop is never spent twice.
 */
async function settleHabit(record: WithId<HabitRecord>, today: string, logsIn?: LogRecord[]): Promise<{ record: WithId<HabitRecord>; logs: LogRecord[] }> {
  const logs = await logsCollection();
  const habits = await habitsCollection();
  let current = record;
  for (let attempt = 0; attempt < 3; attempt++) {
    const from = current.settled?.through ? addDays(current.settled.through, -7) : current.startDate;
    const rows =
      logsIn && attempt === 0
        ? logsIn
        : await logs.find({ habitId: current._id, date: { $gte: from < addDays(today, -SETTLE_WINDOW_DAYS) ? addDays(today, -SETTLE_WINDOW_DAYS) : from } }).toArray();
    const map = new Map(rows.map((l) => [l.date, toLite(l)]));
    const h = { schedule: current.schedule, startDate: current.startDate };
    const base = current.settled ?? FRESH_SETTLED;
    const { state, freezes } = settle(h, map, base, today);
    for (const date of freezes) map.set(date, { date, count: 0, done: false, frozen: true });
    const view = live(h, map, state, today);
    // the latest watered day in view; an older one on record stands only if it's older than what was read
    const seen = rows.filter((l) => l.done).reduce<string | null>((a, l) => (!a || l.date > a ? l.date : a), null);
    const earliest = rows.reduce<string | null>((a, l) => (!a || l.date < a ? l.date : a), null);
    const recorded = current.board?.lastDone ?? null;
    const lastDone = seen ?? (recorded && (!earliest || recorded < earliest) ? recorded : null);
    const board = { streak: view.streak, best: view.best, drops: view.drops, lastDone };

    const unchanged =
      JSON.stringify(state) === JSON.stringify(base) && JSON.stringify(board) === JSON.stringify(current.board);
    if (unchanged) return { record: current, logs: rows };

    if (freezes.length) {
      await logs.bulkWrite(
        freezes.map((date) => ({
          updateOne: {
            filter: { habitId: current._id, date },
            update: {
              $setOnInsert: { userId: current.userId, habitId: current._id, seedId: current.seedId, date, count: 0, done: false, at: new Date() },
              $set: { frozen: true },
            },
            upsert: true,
          },
        })),
        { ordered: false }
      );
    }
    const updated = await habits.findOneAndUpdate(
      { _id: current._id, rev: current.rev ?? 0 },
      { $set: { settled: state, board }, $inc: { rev: 1 } },
      { returnDocument: "after" }
    );
    if (updated) {
      const rowsNow = freezes.length ? await logs.find({ habitId: current._id, date: { $gte: addDays(today, -SETTLE_WINDOW_DAYS) } }).toArray() : rows;
      return { record: updated, logs: rowsNow };
    }
    const fresh = await habits.findOne({ _id: current._id });
    if (!fresh) return { record: current, logs: rows };
    current = fresh;
  }
  return { record: current, logs: await logs.find({ habitId: current._id }).limit(500).toArray() };
}

/** Days of history sent to the app: enough for every day a habit's strength reads. */
const RECENT_DAYS = STRENGTH_WINDOW_DAYS;

/** Every habit, settled to today, with the recent days the garden draws from. */
export async function loadGarden(userId: ObjectId, today: string) {
  return withDbRetry(async () => {
    await ensureHabitIndexes();
    const habits = await habitsCollection();
    const logs = await logsCollection();
    const all = await habits.find({ userId }).sort({ order: 1, createdAt: 1 }).limit(MAX_HABITS * 3).toArray();
    const active = all.filter((h) => !h.archivedAt);
    const rows = active.length
      ? await logs.find({ userId, habitId: { $in: active.map((h) => h._id) }, date: { $gte: addDays(today, -SETTLE_WINDOW_DAYS) } }).toArray()
      : [];
    const byHabit = new Map<string, LogRecord[]>();
    for (const l of rows) {
      const key = l.habitId.toHexString();
      const list = byHabit.get(key);
      if (list) list.push(l);
      else byHabit.set(key, [l]);
    }
    const settled = await Promise.all(active.map((h) => settleHabit(h, today, byHabit.get(h._id.toHexString()) ?? [])));
    const recentFrom = addDays(today, -RECENT_DAYS);
    return {
      habits: settled.map((s) => toHabitView(s.record)),
      archived: all.filter((h) => h.archivedAt).map(toHabitView),
      logs: settled.flatMap((s) => s.logs.filter((l) => l.date >= recentFrom).map(toLogView)),
      gardener: await getGardener(userId),
      nudges: await gardenNudgesOn(userId),
    };
  });
}

/* -------------------------------------------------------------- planting */

export type HabitInput = {
  seedId?: unknown;
  name?: unknown;
  emoji?: unknown;
  species?: unknown;
  color?: unknown;
  schedule?: unknown;
  target?: unknown;
  unit?: unknown;
  reminder?: unknown;
  why?: unknown;
};

export async function plantHabit(userId: ObjectId, input: HabitInput, today: string, timezone: unknown) {
  await ensureHabitIndexes();
  const habits = await habitsCollection();
  const seed = typeof input.seedId === "string" ? seedOf(input.seedId) : null;
  if (input.seedId !== undefined && input.seedId !== null && !seed) bad("That idea doesn't exist.");

  const name = cleanHabitName(input.name ?? seed?.name);
  if (!name) bad("Give the habit a name.");
  const schedule = input.schedule === undefined ? seed?.schedule ?? { kind: "daily" as const } : cleanSchedule(input.schedule);
  if (!schedule) bad("That schedule isn't one Kairo understands.");
  const target = input.target === undefined ? seed?.target ?? 1 : input.target;
  if (!Number.isInteger(target) || (target as number) < 1 || (target as number) > 50) bad("A daily target is a whole number from 1 to 50.");
  if (input.reminder !== undefined && input.reminder !== null && !cleanReminder(input.reminder)) bad("A reminder is a time like 07:30.");
  if (input.species !== undefined && !isSpecies(input.species)) bad("That plant isn't one of the choices.");
  if (input.color !== undefined && !isHabitColor(input.color)) bad("That colour isn't in the palette.");

  const count = await habits.countDocuments({ userId, archivedAt: null });
  if (count >= MAX_HABITS) bad(`You can keep up to ${MAX_HABITS} habits. Archive one to make room.`);
  if (seed) {
    const twin = await habits.findOne({ userId, seedId: seed.id, archivedAt: null }, { projection: { _id: 1 } });
    if (twin) bad(`“${seed.name}” is already on your list.`);
  }

  const last = await habits.find({ userId, archivedAt: null }).sort({ order: -1 }).limit(1).toArray();
  const now = new Date();
  const record: HabitRecord = {
    _id: new ObjectId(),
    userId,
    name,
    emoji: cleanEmoji(input.emoji) ?? seed?.emoji ?? "🌱",
    species: (isSpecies(input.species) ? input.species : seed?.species) ?? "sunflower",
    color: (isHabitColor(input.color) ? input.color : seed?.color) ?? "sun",
    seedId: seed?.id ?? null,
    schedule: schedule as HabitSchedule,
    target: target as number,
    unit: cleanShort(input.unit ?? seed?.unit ?? "", 16),
    reminder: cleanReminder(input.reminder),
    timezone: safeTimeZone(timezone),
    why: cleanShort(input.why ?? seed?.why ?? "", 140),
    startDate: today,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    order: (last[0]?.order ?? 0) + 1,
    growth: 0,
    settled: FRESH_SETTLED,
    harvested: { fruit: 0, golden: 0 },
    board: { streak: 0, best: 0, drops: 0, lastDone: null },
    rev: 0,
  };
  await habits.insertOne(record);
  if (seed) {
    // two taps on two devices can both pass the check above; the earlier plant wins
    const first = await habits.find({ userId, seedId: seed.id, archivedAt: null }).sort({ _id: 1 }).limit(1).next();
    if (first && !first._id.equals(record._id)) {
      await habits.deleteOne({ _id: record._id, userId });
      bad(`“${seed.name}” is already on your list.`);
    }
  }
  const { scheduleHabitReminders } = await import("./habit-reminders");
  await scheduleHabitReminders(record);
  return toHabitView(record);
}

export async function updateHabit(userId: ObjectId, id: string, input: HabitInput & { order?: unknown }, today: string, timezone: unknown) {
  if (!ObjectId.isValid(id)) return null;
  const habits = await habitsCollection();
  const existing = await habits.findOne({ _id: new ObjectId(id), userId });
  if (!existing) return null;

  const set: Partial<HabitRecord> = { updatedAt: new Date() };
  if (input.name !== undefined) {
    const name = cleanHabitName(input.name);
    if (!name) bad("Give the habit a name.");
    set.name = name;
  }
  if (input.emoji !== undefined) set.emoji = cleanEmoji(input.emoji) ?? existing.emoji;
  if (input.species !== undefined) {
    if (!isSpecies(input.species)) bad("That plant isn't one of the choices.");
    set.species = input.species as SpeciesId;
  }
  if (input.color !== undefined) {
    if (!isHabitColor(input.color)) bad("That colour isn't in the palette.");
    set.color = input.color as HabitColor;
  }
  if (input.unit !== undefined) set.unit = cleanShort(input.unit, 16);
  if (input.why !== undefined) set.why = cleanShort(input.why, 140);
  if (input.reminder !== undefined) {
    if (input.reminder !== null && !cleanReminder(input.reminder)) bad("A reminder is a time like 07:30.");
    set.reminder = cleanReminder(input.reminder);
    set.timezone = safeTimeZone(timezone ?? existing.timezone);
  }
  if (input.order !== undefined) {
    if (typeof input.order !== "number" || !Number.isFinite(input.order)) bad("order must be a number");
    set.order = input.order as number;
  }
  let rules = false;
  if (input.schedule !== undefined) {
    const schedule = cleanSchedule(input.schedule);
    if (!schedule) bad("That schedule isn't one Kairo understands.");
    if (JSON.stringify(schedule) !== JSON.stringify(existing.schedule)) {
      set.schedule = schedule as HabitSchedule;
      rules = true;
    }
  }
  if (input.target !== undefined) {
    if (!Number.isInteger(input.target) || (input.target as number) < 1 || (input.target as number) > 50) bad("A daily target is a whole number from 1 to 50.");
    if (input.target !== existing.target) {
      set.target = input.target as number;
      rules = true;
    }
  }
  // New rules re-read the whole history under them. The best streak stays: it happened.
  if (rules) set.settled = { ...FRESH_SETTLED, best: existing.settled?.best ?? 0 };

  const updated = await habits.findOneAndUpdate({ _id: existing._id, userId }, { $set: set, $inc: { rev: 1 } }, { returnDocument: "after" });
  if (!updated) return null;
  if (set.reminder !== undefined || rules) {
    const { scheduleHabitReminders } = await import("./habit-reminders");
    await scheduleHabitReminders(updated);
  }
  return toHabitView((await settleHabit(updated, today)).record);
}

/** Retiring a plant sends it to the compost, where it can be brought back. */
export async function archiveHabit(userId: ObjectId, id: string, archived: boolean) {
  if (!ObjectId.isValid(id)) return null;
  const habits = await habitsCollection();
  if (!archived) {
    const count = await habits.countDocuments({ userId, archivedAt: null });
    if (count >= MAX_HABITS) bad(`You can keep up to ${MAX_HABITS} habits. Archive one to make room.`);
    const doc = await habits.findOne({ _id: new ObjectId(id), userId });
    if (doc?.seedId && (await habits.findOne({ userId, seedId: doc.seedId, archivedAt: null, _id: { $ne: doc._id } }))) {
      bad("That idea is already on your list.");
    }
  }
  const updated = await habits.findOneAndUpdate(
    { _id: new ObjectId(id), userId },
    { $set: { archivedAt: archived ? new Date() : null, updatedAt: new Date() }, $inc: { rev: 1 } },
    { returnDocument: "after" }
  );
  if (!updated) return null;
  const { scheduleHabitReminders } = await import("./habit-reminders");
  await scheduleHabitReminders(updated);
  return toHabitView(updated);
}

export async function deleteHabitForever(userId: ObjectId, id: string): Promise<"deleted" | "missing" | "active"> {
  if (!ObjectId.isValid(id)) return "missing";
  const habits = await habitsCollection();
  const doc = await habits.findOne({ _id: new ObjectId(id), userId });
  if (!doc) return "missing";
  if (!doc.archivedAt) return "active";
  await Promise.all([
    habits.deleteOne({ _id: doc._id, userId }),
    (await logsCollection()).deleteMany({ habitId: doc._id, userId }),
    (await harvestsCollection()).deleteMany({ habitId: doc._id, userId }),
  ]);
  const { scheduleHabitReminders } = await import("./habit-reminders");
  await scheduleHabitReminders({ ...doc, archivedAt: new Date() });
  return "deleted";
}

/* -------------------------------------------------------------- watering */

export type WaterResult = {
  habit: HabitView;
  logs: HabitLogView[];
  /** What happened, for the garden to celebrate. */
  events: { grew: boolean; ripened: boolean; golden: boolean; streak: number };
};

/**
 * Waters a habit for today or yesterday. `delta` adds to the day's count (a
 * glass of water); `count` sets it outright (ticking a yes/no habit on or off).
 * The count is clamped and "done" decided in the same write, so two quick taps
 * on two devices can't leave a day half-counted.
 */
export async function waterHabit(
  userId: ObjectId,
  id: string,
  input: { date: unknown; delta?: unknown; count?: unknown },
  today: string
): Promise<WaterResult | null> {
  if (!ObjectId.isValid(id)) return null;
  if (!isDateKey(input.date) || (input.date !== today && input.date !== addDays(today, -1))) {
    bad("Only today, or yesterday, can be marked.");
  }
  const date = input.date as string;
  const hasDelta = input.delta !== undefined;
  if (hasDelta && (!Number.isInteger(input.delta) || Math.abs(input.delta as number) > 50 || input.delta === 0)) bad("delta must be a whole number");
  if (!hasDelta && (!Number.isInteger(input.count) || (input.count as number) < 0 || (input.count as number) > 99)) bad("count must be a whole number from 0 to 99");

  await ensureHabitIndexes();
  const habits = await habitsCollection();
  const logs = await logsCollection();
  const habit = await habits.findOne({ _id: new ObjectId(id), userId });
  if (!habit) return null;
  if (habit.archivedAt) bad("That habit is archived. Restore it to mark it done.");
  if (date < habit.startDate) bad("That day is before the habit started.");

  const cap = Math.max(99, habit.target);
  const change = hasDelta ? { $add: [{ $ifNull: ["$count", 0] }, input.delta as number] } : (input.count as number);
  await logs.updateOne(
    { habitId: habit._id, date },
    [
      {
        $set: {
          userId: habit.userId,
          habitId: habit._id,
          seedId: habit.seedId,
          date,
          frozen: { $ifNull: ["$frozen", false] },
          at: new Date(),
          count: { $max: [0, { $min: [cap, change] }] },
        },
      },
      { $set: { done: { $gte: ["$count", habit.target] } } },
    ],
    { upsert: true }
  );

  const growth = await logs.countDocuments({ habitId: habit._id, done: true });
  const withGrowth = await habits.findOneAndUpdate({ _id: habit._id }, { $set: { growth, updatedAt: new Date() } }, { returnDocument: "after" });
  if (!withGrowth) return null;
  const { record, logs: rows } = await settleHabit(withGrowth, today);

  const oldGrowth = habit.growth ?? 0;
  const oldBest = habit.board?.best ?? 0;
  return {
    habit: toHabitView(record),
    logs: rows.filter((l) => l.date >= addDays(today, -RECENT_DAYS)).map(toLogView),
    events: {
      grew: stageOf(growth).index > stageOf(oldGrowth).index,
      ripened: fruitsEarned(growth) > fruitsEarned(oldGrowth),
      golden: goldenEarned(record.board.best) > goldenEarned(oldBest),
      streak: record.board.streak,
    },
  };
}

/** Picks a ripe fruit. Only as many can be picked as have ripened, however fast the taps. */
export async function harvestFruit(userId: ObjectId, id: string, kind: unknown): Promise<{ harvest: Harvest; habit: HabitView } | null> {
  if (!ObjectId.isValid(id)) return null;
  if (kind !== "fruit" && kind !== "golden") bad("kind is fruit or golden");
  const habits = await habitsCollection();
  const habit = await habits.findOne({ _id: new ObjectId(id), userId });
  if (!habit) return null;
  const earned = kind === "fruit" ? fruitsEarned(habit.growth) : goldenEarned(Math.max(habit.board?.best ?? 0, habit.settled?.best ?? 0));
  const field = kind === "fruit" ? "harvested.fruit" : "harvested.golden";
  const updated = await habits.findOneAndUpdate(
    { _id: habit._id, userId, [field]: { $lt: earned } },
    { $inc: { [field]: 1 } },
    { returnDocument: "after" }
  );
  if (!updated) bad("Nothing is ripe on that plant yet.");
  const record: HarvestRecord = {
    _id: new ObjectId(),
    userId,
    habitId: habit._id,
    habitName: habit.name,
    species: habit.species,
    kind: kind as "fruit" | "golden",
    at: new Date(),
  };
  await (await harvestsCollection()).insertOne(record);
  return {
    harvest: { id: record._id.toHexString(), habitName: record.habitName, species: record.species, kind: record.kind, at: record.at.toISOString() },
    habit: toHabitView(updated!),
  };
}

export async function basket(userId: ObjectId): Promise<Harvest[]> {
  const rows = await (await harvestsCollection()).find({ userId }).sort({ at: -1 }).limit(500).toArray();
  return rows.map((r) => ({ id: r._id.toHexString(), habitName: r.habitName, species: r.species, kind: r.kind, at: r.at.toISOString() }));
}

export async function habitHistory(userId: ObjectId, id: string, from: string, to: string): Promise<HabitLogView[] | null> {
  if (!ObjectId.isValid(id)) return null;
  const habit = await (await habitsCollection()).findOne({ _id: new ObjectId(id), userId }, { projection: { _id: 1 } });
  if (!habit) return null;
  const rows = await (await logsCollection()).find({ habitId: habit._id, userId, date: { $gte: from, $lte: to } }).limit(800).toArray();
  return rows.map(toLogView);
}

/**
 * The journal waters its own plant. A page written today, or yesterday, fills
 * that day for any habit planted from the journal seed — never lowering a day
 * someone already watered by hand.
 */
export async function waterJournalHabit(userId: ObjectId, date: string): Promise<void> {
  if (!isDateKey(date)) return;
  const habits = await habitsCollection();
  const plant = await habits.findOne({ userId, seedId: "journal", archivedAt: null });
  if (!plant) return;
  // only a page for today or yesterday where the gardener lives: an old page
  // edited now didn't happen now, and a page written ahead hasn't happened yet
  const today = todayIn(plant.timezone);
  if (date !== today && date !== addDays(today, -1)) return;
  const existing = await (await logsCollection()).findOne({ habitId: plant._id, date });
  if (existing?.done) return;
  try {
    await waterHabit(userId, plant._id.toHexString(), { date, count: plant.target }, today);
  } catch {
    /* a day before the plant was planted: nothing to water */
  }
}

/* ------------------------------------------------------------- gardeners */

export async function getGardener(userId: ObjectId): Promise<Gardener | null> {
  const user = await (await getDb()).collection("users").findOne({ _id: userId }, { projection: { gardener: 1 } });
  const g = user?.gardener as GardenerRecord | undefined;
  return g && isAnimal(g.animal) ? { name: g.name, animal: g.animal, public: Boolean(g.public) } : null;
}

export async function setGardener(userId: ObjectId, input: { name?: unknown; animal?: unknown; public?: unknown }): Promise<Gardener> {
  const name = cleanGardenerName(input.name);
  if (!name) bad("A name is 2 to 24 letters, numbers or spaces.");
  if (!isAnimal(input.animal)) bad("Pick one of the animals.");
  if (typeof input.public !== "boolean") bad("public must be true or false");
  const gardener: GardenerRecord = { name: name!, animal: input.animal as string, public: input.public as boolean };
  await (await getDb()).collection("users").updateOne({ _id: userId }, { $set: { gardener } });
  return gardener as Gardener;
}

/** Whether the evening nudge is on (it is, until someone switches it off). */
export async function gardenNudgesOn(userId: ObjectId): Promise<boolean> {
  const user = await (await getDb()).collection("users").findOne({ _id: userId }, { projection: { gardenNudges: 1 } });
  return user?.gardenNudges !== false;
}

export async function setGardenNudges(userId: ObjectId, on: boolean, timezone: unknown): Promise<boolean> {
  await (await getDb()).collection("users").updateOne({ _id: userId }, on ? { $unset: { gardenNudges: "" } } : { $set: { gardenNudges: false } });
  const { scheduleEveningSave } = await import("./habit-reminders");
  const { scheduledCollection } = await import("./push");
  if (on) await scheduleEveningSave(userId, safeTimeZone(timezone));
  else await (await scheduledCollection()).deleteMany({ userId, kind: "garden-evening" });
  return on;
}

/**
 * People this account shares a list with — the friends board. Lists only: a
 * single task shared once is too thin a tie to put someone's streaks in front
 * of you, and a board of two is a board where a pseudonym stops hiding anyone.
 */
async function friendIds(userId: ObjectId): Promise<ObjectId[]> {
  const db = await getDb();
  const filter = { $or: [{ userId }, { memberIds: userId }], "memberIds.0": { $exists: true } };
  const lists = await db.collection("lists").find(filter, { projection: { userId: 1, memberIds: 1 } }).limit(500).toArray();
  const ids = new Map<string, ObjectId>([[userId.toHexString(), userId]]);
  for (const doc of lists) {
    ids.set((doc.userId as ObjectId).toHexString(), doc.userId as ObjectId);
    for (const m of (doc.memberIds as ObjectId[]) ?? []) ids.set(m.toHexString(), m);
  }
  return [...ids.values()];
}

/* ------------------------------------------------------------ community */

let seedCache: { at: number; stats: SeedStat[] } | null = null;

/** How many gardeners grow each seed, and how many watered it lately. Real counts, cached briefly. */
export async function seedStats(): Promise<SeedStat[]> {
  // five minutes in production; none while developing, where counts should move as you test
  const ttl = process.env.NODE_ENV === "production" ? 5 * 60_000 : 0;
  if (seedCache && Date.now() - seedCache.at < ttl) return seedCache.stats;
  const habits = await habitsCollection();
  const lately = addDays(utcToday(), -1);
  const rows = await habits
    .aggregate<{ _id: string; gardeners: number; watered: number }>([
      { $match: { seedId: { $ne: null }, archivedAt: null } },
      {
        $group: {
          _id: "$seedId",
          users: { $addToSet: "$userId" },
          watered: { $sum: { $cond: [{ $gte: ["$board.lastDone", lately] }, 1, 0] } },
        },
      },
      { $project: { gardeners: { $size: "$users" }, watered: 1 } },
    ])
    .toArray();
  const stats = rows.map((r) => ({ seedId: r._id, gardeners: r.gardeners, wateredToday: r.watered }));
  seedCache = { at: Date.now(), stats };
  return stats;
}

type BoardEntry = { userId: string; name: string; animal: string; streak: number; best: number };

/**
 * Other gardeners' rows, cached for a minute. Shared through globalThis so every
 * route bundle in a process reads the same one — but nothing depends on it
 * being cleared: the person asking always gets their own row fresh (below).
 */
declare global {
  var _kairoBoardCache: Map<string, { at: number; rows: BoardEntry[] }> | undefined;
}
const boards = (): Map<string, { at: number; rows: BoardEntry[] }> => (globalThis._kairoBoardCache ??= new Map());

/** One gardener's standing for a seed: their best plant of it, by the streak a board may show. */
function standingOf(plants: Pick<HabitRecord, "board" | "schedule" | "settled">[], today: string): { streak: number; best: number } | null {
  let top: { streak: number; best: number } | null = null;
  for (const p of plants) {
    const b = p.board ?? { streak: 0, best: 0, drops: 0, lastDone: null };
    const streak = effectiveStreak(b.streak, b.lastDone, b.drops, p.schedule, today);
    const best = Math.max(b.best, p.settled?.best ?? 0);
    if (!top || streak > top.streak || (streak === top.streak && best > top.best)) top = { streak, best };
  }
  return top;
}

const byStanding = (a: BoardEntry, b: BoardEntry) => b.streak - a.streak || b.best - a.best || a.name.localeCompare(b.name);

/**
 * A seed's leaderboard. Only gardeners who chose a public name appear, by that
 * name and a garden animal — never an email or a photo. Your own row is always
 * shown to you, marked, with the rank you'd have if you joined.
 */
export async function leaderboard(userId: ObjectId, seedId: string, scope: "global" | "friends", today: string): Promise<Board> {
  if (!seedOf(seedId)) bad("That idea doesn't exist.");
  const me = userId.toHexString();
  const habits = await habitsCollection();
  const key = scope === "global" ? `${seedId}:${today}` : `${seedId}:${today}:${me}`;
  const cache = boards();
  let entry = cache.get(key);
  if (!entry || Date.now() - entry.at > 60_000) {
    const filter: Record<string, unknown> = { seedId, archivedAt: null };
    if (scope === "friends") filter.userId = { $in: await friendIds(userId) };
    const plants = await habits.find(filter, { projection: { userId: 1, board: 1, schedule: 1, settled: 1 } }).limit(5000).toArray();
    const users = await (await getDb())
      .collection("users")
      .find({ _id: { $in: [...new Set(plants.map((p) => p.userId.toHexString()))].map((h) => new ObjectId(h)) }, disabled: { $ne: true }, "gardener.public": true }, { projection: { gardener: 1 } })
      .toArray();
    const byUser = new Map(users.map((u) => [u._id.toHexString(), u.gardener as GardenerRecord]));
    const grouped = new Map<string, typeof plants>();
    for (const p of plants) {
      const hex = p.userId.toHexString();
      const list = grouped.get(hex);
      if (list) list.push(p);
      else grouped.set(hex, [p]);
    }
    const rows: BoardEntry[] = [];
    for (const [hex, theirs] of grouped) {
      const g = byUser.get(hex);
      const standing = standingOf(theirs, today);
      if (g && isAnimal(g.animal) && standing) rows.push({ userId: hex, name: g.name, animal: g.animal, ...standing });
    }
    rows.sort(byStanding);
    entry = { at: Date.now(), rows };
    cache.set(key, entry);
    if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  }

  // the asker's own standing, read fresh, so a watering or a name change shows at once
  const [myPlants, gardener] = await Promise.all([
    habits.find({ userId, seedId, archivedAt: null }, { projection: { board: 1, schedule: 1, settled: 1 } }).toArray(),
    getGardener(userId),
  ]);
  const standing = standingOf(myPlants, today);
  const others = entry.rows.filter((r) => r.userId !== me);
  const visible = standing && gardener?.public ? [...others, { userId: me, name: gardener.name, animal: gardener.animal, ...standing }].sort(byStanding) : others;

  // competition ranking: tied streaks share a rank
  const ranked: BoardRow[] = [];
  let rank = 0;
  visible.forEach((r, i) => {
    if (i === 0 || r.streak !== visible[i - 1].streak) rank = i + 1;
    ranked.push({ rank, name: r.name, animal: r.animal, streak: r.streak, best: r.best, me: r.userId === me });
  });
  let mine = ranked.find((r) => r.me) ?? null;
  if (!mine && standing) {
    const ahead = others.filter((r) => r.streak > standing.streak).length;
    mine = { rank: ahead + 1, name: gardener?.name ?? "You", animal: gardener?.animal ?? "1", ...standing, me: true };
  }
  const top = ranked.slice(0, 50);
  return { seedId, scope, rows: top, me: mine, gardeners: visible.length };
}

export function clearBoards(): void {
  boards().clear();
  seedCache = null;
}
