import {
  addDays,
  fruitsEarned,
  goldenEarned,
  isDateKey,
  live,
  scheduleLabel,
  SEEDS,
  seedOf,
  speciesOf,
  stageOf,
  type HabitView,
  type LogLite,
} from "../habits-shared";
import { HabitInputError, loadGarden, plantHabit, waterHabit } from "../habits";
import { SITE_URL } from "../site";
import { canWrite, type McpContext } from "./context";
import { ToolFail } from "./fail";
import { json, type JsonSchema } from "./protocol";
import { optBool, optInt, optString, reqString, type Args } from "./args";
import type { Tool } from "./tools";

/**
 * The garden, over MCP: what's due today, checking a habit off, and planting a
 * new one. No deleting, no composting and no editing a streak by hand — an
 * assistant can water a plant the user says they kept, and nothing more.
 */

function obj(properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema {
  return { type: "object", properties, ...(required.length ? { required } : {}), additionalProperties: false };
}

const habitRef = {
  habitId: { type: "string", description: "The habit's id, as returned by habits_today." } as JsonSchema,
  name: { type: "string", maxLength: 60, description: "The habit's name, when you don't have its id." } as JsonSchema,
};

type Garden = Awaited<ReturnType<typeof loadGarden>>;

/**
 * The garden as this connection may see it. The journal plant waters itself
 * from journal pages, so its streak says whether someone wrote in their diary:
 * a key without the journal doesn't see that plant at all.
 */
async function gardenFor(ctx: McpContext): Promise<Garden> {
  const garden = await loadGarden(ctx.userId, ctx.today);
  if (ctx.includeJournal) return garden;
  const hidden = new Set([...garden.habits, ...garden.archived].filter((h) => h.seedId === "journal").map((h) => h.id));
  return {
    ...garden,
    habits: garden.habits.filter((h) => !hidden.has(h.id)),
    archived: garden.archived.filter((h) => !hidden.has(h.id)),
    logs: garden.logs.filter((l) => !hidden.has(l.habitId)),
  };
}

function logsOf(garden: Garden, id: string): Map<string, LogLite> {
  return new Map(garden.logs.filter((l) => l.habitId === id).map((l) => [l.date, { date: l.date, count: l.count, done: l.done, frozen: l.frozen }]));
}

function shape(garden: Garden, h: HabitView, today: string) {
  const lv = live({ schedule: h.schedule, startDate: h.startDate }, logsOf(garden, h.id), h.settled, today);
  const stage = stageOf(h.growth);
  const ripe = Math.max(0, fruitsEarned(h.growth) - h.harvested.fruit) + Math.max(0, goldenEarned(Math.max(lv.best, h.settled.best)) - h.harvested.golden);
  return {
    habitId: h.id,
    name: h.name,
    schedule: scheduleLabel(h.schedule),
    ...(h.target > 1 ? { target: h.target, unit: h.unit || null, todayCount: lv.todayCount } : {}),
    dueToday: lv.dueToday,
    doneToday: lv.todayDone,
    ...(lv.week ? { thisWeek: `${lv.week.done} of ${lv.week.times}` } : {}),
    streak: lv.streak,
    bestStreak: lv.best,
    dewDrops: lv.drops,
    plant: `${speciesOf(h.species).label}, ${stage.label.toLowerCase()}`,
    ...(ripe > 0 ? { ripeFruit: ripe } : {}),
    // a plain fact for when the user says they did it yesterday; not a prompt to act
    ...(lv.rescue && !lv.rescue.covered && lv.rescue.keeps > 0 ? { yesterday: `not checked in (${addDays(today, -1)})` } : {}),
  };
}

function stagePhrase(label: string): string {
  if (label === "In bloom" || label === "Bearing fruit") return label.toLowerCase();
  return /^[aeiou]/i.test(label) ? `an ${label.toLowerCase()}` : `a ${label.toLowerCase()}`;
}

function resolveHabit(garden: Garden, args: Args): HabitView {
  const id = optString(args, "habitId", 64)?.trim();
  if (id) {
    const found = garden.habits.find((h) => h.id === id);
    if (found) return found;
    if (garden.archived.some((h) => h.id === id)) throw new ToolFail("That habit is in the compost. The user can replant it in Kairo.");
    throw new ToolFail(`No habit with id ${id}. Use habits_today to see the garden.`);
  }
  const name = optString(args, "name", 60)?.trim().toLowerCase();
  if (!name) throw new ToolFail("Give habitId or name.");
  const exact = garden.habits.filter((h) => h.name.toLowerCase() === name);
  const found = exact.length ? exact : garden.habits.filter((h) => h.name.toLowerCase().includes(name));
  if (found.length === 1) return found[0];
  if (found.length === 0) throw new ToolFail(`No habit is called "${name}". Use habits_today to see the garden.`);
  throw new ToolFail(`Several habits match "${name}": ${found.map((h) => `${h.name} (id ${h.id})`).join("; ")}. Ask which one, then pass its habitId.`);
}

const habitsToday: Tool = {
  name: "habits_today",
  title: "Habits today",
  habits: true,
  write: false,
  annotations: { readOnlyHint: true },
  description:
    "The user's habit garden in Kairo: every habit with whether it's due and done today, its streak, dew drops (which cover a missed day), and how its plant is growing. Call this when the user asks about their habits or streaks, or before checking one in.",
  inputSchema: obj({}),
  run: async (ctx) => {
    const garden = await gardenFor(ctx);
    const habits = garden.habits.map((h) => shape(garden, h, ctx.today));
    const due = habits.filter((h) => h.dueToday || h.doneToday);
    return json({
      today: ctx.today,
      summary: habits.length
        ? `${due.filter((h) => h.doneToday).length} of ${due.length} due habits done today.`
        : "No habits planted yet. The user can plant one, or you can with habit_create if they ask.",
      habits,
      url: `${SITE_URL}/garden`,
    });
  },
};

const habitCheckIn: Tool = {
  name: "habit_check_in",
  title: "Check in a habit",
  habits: true,
  write: true,
  description:
    "Mark a habit as done (waters its plant) for today, or for yesterday if the user says they did it yesterday — only when the user tells you they did it. For a habit with a daily target (like 8 glasses), pass amount to add that many, or count to set the day's total. undo: true takes the check-in back.",
  inputSchema: obj({
    ...habitRef,
    day: { type: "string", enum: ["today", "yesterday"], description: "Default today." },
    amount: { type: "integer", minimum: 1, maximum: 50, description: "For counted habits: how many to add." },
    count: { type: "integer", minimum: 0, maximum: 99, description: "For counted habits: the day's total, outright." },
    undo: { type: "boolean", description: "Take the check-in back instead." },
  }),
  run: async (ctx, _scope, args) => {
    if (!canWrite(ctx)) throw new ToolFail("This connection is read-only, so it can't check habits in.");
    const garden = await gardenFor(ctx);
    const habit = resolveHabit(garden, args);
    const dayArg = optString(args, "day", 10) ?? "today";
    if (dayArg !== "today" && dayArg !== "yesterday") throw new ToolFail("day must be today or yesterday.");
    const date = dayArg === "today" ? ctx.today : addDays(ctx.today, -1);
    if (!isDateKey(date) || date < habit.startDate) throw new ToolFail(`${habit.name} was planted on ${habit.startDate}, after that day.`);
    const amount = optInt(args, "amount", 1, 50);
    const count = optInt(args, "count", 0, 99);
    const undo = optBool(args, "undo") ?? false;
    if (amount !== undefined && count !== undefined) throw new ToolFail("Give amount or count, not both.");

    const change = undo ? { count: 0 } : count !== undefined ? { count } : habit.target > 1 && amount !== undefined ? { delta: amount } : { count: habit.target };
    try {
      const result = await waterHabit(ctx.userId, habit.id, { date, ...change }, ctx.today);
      if (!result) throw new ToolFail("That habit isn't in the garden any more.");
      const after = { ...garden, habits: garden.habits.map((h) => (h.id === habit.id ? result.habit : h)), logs: [...garden.logs.filter((l) => l.habitId !== habit.id), ...result.logs] };
      const view = shape(after, result.habit, ctx.today);
      const events = result.events;
      return json({
        checkedIn: undo ? false : true,
        day: date,
        habit: view,
        ...(events.grew ? { grew: `The plant grew: it's ${stagePhrase(stageOf(result.habit.growth).label)} now.` } : {}),
        ...(events.ripened ? { ripened: "A fruit ripened. The user can pick it in the garden." } : {}),
        ...(events.golden ? { golden: "A golden fruit ripened from their streak." } : {}),
      });
    } catch (err) {
      if (err instanceof HabitInputError) throw new ToolFail(err.message);
      throw err;
    }
  },
};

const habitCreate: Tool = {
  name: "habit_create",
  title: "Plant a habit",
  habits: true,
  write: true,
  description: `Plant a new habit in the user's Kairo garden — only when they ask for one. Popular seeds share leaderboards; pass seedId to use one (${SEEDS.map((s) => `${s.id}: ${s.name}`).join("; ")}), or give a name for a custom habit. schedule: {"kind":"daily"}, {"kind":"days","days":[1,3,5]} (0 is Sunday), or {"kind":"weekly","times":3}.`,
  inputSchema: obj({
    seedId: { type: "string", enum: SEEDS.map((s) => s.id), description: "A seed from the catalogue." },
    name: { type: "string", maxLength: 60, description: "The habit, short: 'Read 10 pages'. Required without seedId." },
    schedule: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["daily", "days", "weekly"] },
        days: { type: "array", items: { type: "integer", minimum: 0, maximum: 6 }, maxItems: 7 },
        times: { type: "integer", minimum: 1, maximum: 7 },
      },
      required: ["kind"],
      additionalProperties: false,
    },
    target: { type: "integer", minimum: 1, maximum: 50, description: "Times a day, for counted habits like glasses of water. Default 1." },
    unit: { type: "string", maxLength: 16 },
    reminder: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$", description: "A daily reminder time, 24-hour." },
    why: { type: "string", maxLength: 140, description: "Why it matters to them, in their words." },
  }),
  run: async (ctx, _scope, args) => {
    if (!canWrite(ctx)) throw new ToolFail("This connection is read-only, so it can't plant habits.");
    const seedId = optString(args, "seedId", 40);
    if (seedId !== undefined && !seedOf(seedId)) throw new ToolFail(`No seed called ${seedId}.`);
    if (!seedId) reqString(args, "name", 60);
    try {
      const habit = await plantHabit(
        ctx.userId,
        {
          seedId: seedId ?? null,
          name: args.name,
          schedule: args.schedule,
          target: args.target,
          unit: args.unit,
          reminder: args.reminder,
          why: args.why,
        },
        ctx.today,
        ctx.timezone
      );
      return json({
        planted: habit.name,
        habitId: habit.id,
        schedule: scheduleLabel(habit.schedule),
        plant: speciesOf(habit.species).label,
        url: `${SITE_URL}/garden/${habit.id}`,
      });
    } catch (err) {
      if (err instanceof HabitInputError) throw new ToolFail(err.message);
      throw err;
    }
  },
};

export const HABIT_TOOLS: Tool[] = [habitsToday, habitCheckIn, habitCreate];
