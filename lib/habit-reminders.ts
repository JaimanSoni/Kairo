import { ObjectId } from "mongodb";
import { getDb } from "./db";
import { addDays, isScheduledDay, live, mondayOf, type LogLite } from "./habits-shared";
import { armPrecise, scheduledCollection, sendToUser } from "./push";
import { epochIn, safeTimeZone, todayIn } from "./tz";
import type { HabitRecord } from "./habits";

/**
 * The garden's nudges, riding on Kairo's scheduled pushes.
 *
 * Two kinds. A habit with a reminder time gets one push at that time on the
 * days it's asked for, and none on a day it's already been watered. And once
 * an evening, anyone with a streak of three days or more that is about to
 * break gets a single push naming the plant — no push at all if every such
 * plant is already watered. Each push schedules the next one when it fires.
 */

const EVENING = "20:30";

type Due = { fireAt: number; date: string };

/** The next moment a clock time comes round on a day the habit asks for. */
function nextFire(reminder: string, tz: string, asked: (date: string) => boolean, now = Date.now()): Due | null {
  const today = todayIn(tz, new Date(now));
  for (let i = 0; i < 8; i++) {
    const date = addDays(today, i);
    if (!asked(date)) continue;
    const at = epochIn(date, reminder, tz);
    if (at > now + 30_000) return { fireAt: at, date };
  }
  return null;
}

/** Re-plans a habit's own reminder and the owner's evening save after any change to the habit. */
export async function scheduleHabitReminders(habit: Pick<HabitRecord, "_id" | "userId" | "name" | "emoji" | "reminder" | "timezone" | "schedule" | "archivedAt">): Promise<void> {
  const scheduled = await scheduledCollection();
  await scheduled.deleteMany({ habitId: habit._id });
  if (habit.reminder && !habit.archivedAt) {
    const tz = safeTimeZone(habit.timezone);
    const next = nextFire(habit.reminder, tz, (d) => isScheduledDay(habit.schedule, d));
    if (next) {
      await scheduled.insertOne({
        userId: habit.userId,
        habitId: habit._id,
        kind: "habit",
        fireAt: next.fireAt,
        title: habit.name,
        body: "Time to water it.",
        tag: `habit-${habit._id.toHexString()}`,
        url: `/garden/${habit._id.toHexString()}`,
      });
      armPrecise(next.fireAt);
    }
  }
  await scheduleEveningSave(habit.userId, habit.timezone);
}

/** One evening push per gardener, while they have anything growing. */
export async function scheduleEveningSave(userId: ObjectId, timezone: string): Promise<void> {
  const db = await getDb();
  const scheduled = await scheduledCollection();
  const growing = await db.collection("habits").countDocuments({ userId, archivedAt: null });
  if (growing === 0) {
    await scheduled.deleteMany({ userId, kind: "garden-evening" });
    return;
  }
  if (await scheduled.findOne({ userId, kind: "garden-evening" })) return;
  const tz = safeTimeZone(timezone);
  const next = nextFire(EVENING, tz, () => true);
  if (!next) return;
  await scheduled.insertOne({ userId, kind: "garden-evening", timezone: tz, fireAt: next.fireAt, title: "Kairo", tag: "garden-evening", url: "/garden" });
  armPrecise(next.fireAt);
}

async function logsFor(habitId: ObjectId, from: string): Promise<Map<string, LogLite>> {
  const rows = await (await getDb()).collection("habit_logs").find({ habitId, date: { $gte: from } }).toArray();
  return new Map(rows.map((l) => [String(l.date), { date: String(l.date), count: Number(l.count), done: Boolean(l.done), frozen: Boolean(l.frozen) }]));
}

/**
 * Called when a garden push comes due. Sends it only if it still matters, and
 * plans the next one either way.
 */
export async function fireGardenPush(doc: Record<string, unknown>): Promise<void> {
  const db = await getDb();
  const userId = doc.userId as ObjectId;

  // a switched-off, deleted or lapsed account gets no nudges, and none are planned after this one
  const owner = await db.collection("users").findOne({ _id: userId }, { projection: { disabled: 1, createdAt: 1, billing: 1, gardenNudges: 1 } });
  if (!owner || owner.disabled) return;
  const { accessFor } = await import("./billing");
  if (!(await accessFor({ createdAt: owner.createdAt, billing: owner.billing })).allowed) return;

  if (doc.kind === "habit") {
    const habit = await db.collection<HabitRecord>("habits").findOne({ _id: doc.habitId as ObjectId, userId });
    if (!habit || habit.archivedAt || !habit.reminder) return;
    const tz = safeTimeZone(habit.timezone);
    const today = todayIn(tz);
    const logs = await logsFor(habit._id, mondayOf(addDays(today, -8)));
    const view = live({ schedule: habit.schedule, startDate: habit.startDate }, logs, habit.settled, today);
    if (view.dueToday && !view.todayDone) {
      const count = view.todayCount && habit.target > 1 ? ` ${view.todayCount} of ${habit.target} so far.` : "";
      const streak = view.streak >= 2 ? ` Your ${view.streak}-day streak is growing.` : "";
      await sendToUser(userId, {
        title: habit.name,
        body: `Time to water it.${count}${streak}`,
        tag: `habit-${habit._id.toHexString()}`,
        url: `/garden/${habit._id.toHexString()}`,
      });
    }
    await scheduleHabitReminders(habit);
    return;
  }

  if (doc.kind === "garden-evening") {
    // evening nudges switched off: stay quiet, and stop planning them
    if (owner.gardenNudges === false) return;
    const tz = safeTimeZone(doc.timezone);
    const today = todayIn(tz);
    const habits = await db.collection<HabitRecord>("habits").find({ userId, archivedAt: null }).toArray();
    let worst: { habit: HabitRecord; streak: number } | null = null;
    for (const habit of habits) {
      if ((habit.board?.streak ?? 0) < 3) continue;
      const logs = await logsFor(habit._id, mondayOf(addDays(today, -8)));
      const view = live({ schedule: habit.schedule, startDate: habit.startDate }, logs, habit.settled, today);
      // a weekly habit is only at risk on its week's last day
      const atRisk = habit.schedule.kind === "weekly" ? view.dueToday && addDays(mondayOf(today), 6) === today : view.dueToday && !view.todayDone;
      if (atRisk && view.streak >= 3 && (!worst || view.streak > worst.streak)) worst = { habit, streak: view.streak };
    }
    if (worst) {
      const others = habits.length > 1 ? " Your garden's waiting." : "";
      await sendToUser(userId, {
        title: `${worst.habit.name} still needs water`,
        body: `Water it before bed to keep your ${worst.streak}-day streak.${others}`,
        tag: "garden-evening",
        url: `/garden/${worst.habit._id.toHexString()}`,
      });
    }
    await scheduleEveningSave(userId, tz);
  }
}
