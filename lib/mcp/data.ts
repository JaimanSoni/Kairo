import { ObjectId, type Document, type WithId } from "mongodb";
import { getDb } from "../db";
import { listsCollection, tasksCollection, toTask } from "../tasks";
import { nextOccurrence, repeatLabel } from "../repeat";
import { resolveAvatar } from "../avatars";
import type { Task } from "../types";
import type { McpContext } from "./context";

/** Spotlight holds three. Same number the app refuses to go past, same reason. */
export const SPOTLIGHT_MAX = 3;

/* ------------------------------------------------------------------ scope */

export type Scope = {
  /** The lists this connection may see. */
  visible: WithId<Document>[];
  visibleIds: ObjectId[];
  /** Locked lists this connection is not allowed to see. */
  hiddenIds: ObjectId[];
  names: Map<string, string>;
};

/**
 * What this connection can reach.
 *
 * A PIN-locked list is private by intent, and a connection key carries no PIN,
 * so by default those lists — and everything filed in them — are invisible
 * here. That is the same rule /api/parse already follows when it keeps locked
 * list names out of an AI prompt. A key can be created with the lock opened
 * deliberately; nothing opens it by accident.
 */
export async function loadScope(ctx: McpContext): Promise<Scope> {
  const lists = await listsCollection();
  const all = await lists
    .find({ $or: [{ userId: ctx.userId }, { memberIds: ctx.userId }] })
    .sort({ order: 1, createdAt: 1 })
    .toArray();

  const visible = ctx.includeLocked ? all : all.filter((l) => !l.pinHash);
  const hidden = ctx.includeLocked ? [] : all.filter((l) => Boolean(l.pinHash));

  return {
    visible,
    visibleIds: visible.map((l) => l._id),
    hiddenIds: hidden.map((l) => l._id),
    names: new Map(visible.map((l) => [l._id.toHexString(), String(l.name ?? "")])),
  };
}

/**
 * The Mongo filter for every task this connection may touch: the app's own
 * access rule, with hidden lists subtracted. The subtraction has to be its own
 * clause — a task you own that you filed inside a locked list is still behind
 * the lock, and an `$or` on ownership alone would hand it straight back.
 */
export function taskScopeFilter(ctx: McpContext, scope: Scope): Document {
  const access: Document = {
    $or: [{ userId: ctx.userId }, { memberIds: ctx.userId }, { listId: { $in: scope.visibleIds } }],
  };
  if (scope.hiddenIds.length === 0) return access;
  return { $and: [access, { listId: { $nin: scope.hiddenIds } }] };
}

/* ---------------------------------------------------------------- shaping */

export type ShapedTask = {
  id: string;
  title: string;
  status: Task["status"];
  note?: string;
  plannedFor?: string;
  plannedTime?: string;
  dueDate?: string;
  spotlight?: true;
  list?: { id: string; name: string };
  estimateMin?: number;
  repeat?: string;
  /** ISO instant work started, when something is in progress right now. */
  startedAt?: string;
  reminderAt?: string;
  carriedOver?: number;
  steps?: { id: string; title: string; done: boolean; plannedFor?: string }[];
  assigneeId?: string;
  sharedWith?: number;
  completedAt?: string;
  createdAt?: string;
};

/**
 * Tasks as an assistant should read them: no nulls, no empty arrays, no fields
 * that were never set. A model pays for every token of `"dueDate": null` it is
 * shown, and there are a hundred of those in a busy week.
 */
export function shapeTask(task: Task, scope: Scope, opts?: { full?: boolean }): ShapedTask {
  const out: ShapedTask = { id: task.id, title: task.title, status: task.status };
  if (task.note) out.note = task.note;
  if (task.plannedFor) out.plannedFor = task.plannedFor;
  if (task.plannedTime) out.plannedTime = task.plannedTime;
  if (task.dueDate) out.dueDate = task.dueDate;
  if (task.spotlight) out.spotlight = true;
  if (task.listId) {
    const name = scope.names.get(task.listId);
    if (name !== undefined) out.list = { id: task.listId, name };
  }
  if (typeof task.estimateMin === "number") out.estimateMin = task.estimateMin;
  if (task.repeat) out.repeat = repeatLabel(task.repeat);
  if (task.startedAt) out.startedAt = task.startedAt;
  if (task.reminderAt) out.reminderAt = new Date(task.reminderAt).toISOString();
  if (task.carryCount > 0) out.carriedOver = task.carryCount;
  if (task.subtasks.length > 0) {
    out.steps = task.subtasks.map((s) => ({
      id: s.id,
      title: s.title,
      done: s.done,
      ...(s.plannedFor ? { plannedFor: s.plannedFor } : {}),
    }));
  }
  if (task.assigneeId) out.assigneeId = task.assigneeId;
  if (task.memberIds.length > 0) out.sharedWith = task.memberIds.length;
  if (task.completedAt) out.completedAt = task.completedAt;
  if (opts?.full) out.createdAt = task.createdAt;
  return out;
}

export type ShapedList = {
  id: string;
  name: string;
  emoji: string;
  role: "owner" | "member";
  locked?: true;
  sharedWith?: number;
  openTasks?: number;
};

export function shapeList(doc: WithId<Document>, ctx: McpContext): ShapedList {
  const members = Array.isArray(doc.memberIds) ? (doc.memberIds as ObjectId[]) : [];
  const out: ShapedList = {
    id: doc._id.toHexString(),
    name: String(doc.name ?? ""),
    emoji: String(doc.emoji ?? ""),
    role: (doc.userId as ObjectId).equals(ctx.userId) ? "owner" : "member",
  };
  if (doc.pinHash) out.locked = true;
  if (members.length > 0) out.sharedWith = members.length;
  return out;
}

/* ------------------------------------------------------------------ reads */

export async function findTask(
  ctx: McpContext,
  scope: Scope,
  id: string
): Promise<WithId<Document> | null> {
  if (!ObjectId.isValid(id)) return null;
  const tasks = await tasksCollection();
  return tasks.findOne({ _id: new ObjectId(id), ...taskScopeFilter(ctx, scope) });
}

/**
 * A list by id, or by name when the assistant only knows what the user called
 * it. Name matching is case-insensitive and exact — a fuzzy match that files
 * "Work" into "Homework" is worse than saying the list could not be found.
 */
export function resolveListRef(
  scope: Scope,
  ref: string | null | undefined
): { ok: true; id: ObjectId | null } | { ok: false; error: string } {
  if (ref === null || ref === undefined || ref === "") return { ok: true, id: null };
  if (ObjectId.isValid(ref)) {
    const match = scope.visible.find((l) => l._id.toHexString() === ref);
    if (match) return { ok: true, id: match._id };
    // A valid-looking id that is not in scope is either a locked list or
    // someone else's; both answer the same way.
    return {
      ok: false,
      error: `No list with id ${ref} — call list_lists to see what is available.`,
    };
  }
  const wanted = ref.trim().toLowerCase();
  const hits = scope.visible.filter((l) => String(l.name ?? "").trim().toLowerCase() === wanted);
  if (hits.length === 1) return { ok: true, id: hits[0]._id };
  if (hits.length > 1) {
    return { ok: false, error: `More than one list is called "${ref}". Use its id instead.` };
  }
  const names = scope.visible.map((l) => String(l.name ?? "")).join(", ") || "none yet";
  return { ok: false, error: `No list called "${ref}". Lists available: ${names}.` };
}

/** Where a missed repeating task's rule lands next, computed without writing. */
export function projectedNext(task: Task, today: string): string | null {
  if (!task.repeat || !task.plannedFor || task.plannedFor >= today) return null;
  let next = task.plannedFor;
  for (let i = 0; i < 400 && next < today; i++) next = nextOccurrence(task.repeat, next);
  return next < today ? null : next;
}

/* -------------------------------------------------------------- mutations */

export type CompleteOutcome = {
  task: Task;
  /** For a repeating task: the day the series moved on to. */
  nextOccurrence?: string;
  loggedCopyId?: string;
};

/**
 * Completing, with the repeat rules the app uses.
 *
 * A repeating task is one document that advances, so finishing it does two
 * things: it leaves a finished copy behind for today's Log, and it moves the
 * series on to its next occurrence. Doing only the second would erase the
 * evidence that today's was done, which is the one thing the Log is for.
 */
export async function completeTask(
  ctx: McpContext,
  doc: WithId<Document>
): Promise<CompleteOutcome> {
  const tasks = await tasksCollection();
  const task = toTask(doc);
  const now = new Date();

  if (!task.repeat) {
    const updated = await tasks.findOneAndUpdate(
      { _id: doc._id },
      {
        $set: {
          status: "done",
          completedAt: now,
          spotlight: false,
          startedAt: null,
          reminderAt: null,
          updatedAt: now,
        },
      },
      { returnDocument: "after" }
    );
    await cancelReminder(ctx, doc._id);
    return { task: toTask(updated ?? doc) };
  }

  const today = ctx.today;
  const copy = {
    userId: ctx.userId,
    title: task.title,
    note: task.note,
    status: "done" as const,
    plannedFor: today,
    plannedTime: task.plannedTime,
    dueDate: null,
    spotlight: false,
    listId: task.listId ? new ObjectId(task.listId) : null,
    estimateMin: task.estimateMin,
    order: now.getTime(),
    carryCount: 0,
    repeat: null,
    reminderAt: null,
    assigneeId: null,
    instanceOf: doc._id,
    memberIds: [] as ObjectId[],
    subtasks: task.subtasks,
    completedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  const inserted = await tasks.insertOne(copy);

  // The series moves on from whichever is later: today, or a day it was
  // already planned for. Finishing tomorrow's early must not schedule another
  // one for tomorrow.
  const after = task.plannedFor && task.plannedFor > today ? task.plannedFor : today;
  const next = nextOccurrence(task.repeat, after);
  const advanced = await tasks.findOneAndUpdate(
    { _id: doc._id },
    {
      $set: {
        plannedFor: next,
        status: "planned",
        spotlight: false,
        carryCount: 0,
        reminderAt: null,
        startedAt: null,
        completedAt: null,
        // a fresh occurrence starts with a fresh checklist
        subtasks: task.subtasks.map((s) => ({
          id: s.id,
          title: s.title,
          done: false,
          plannedFor: null,
        })),
        updatedAt: now,
      },
    },
    { returnDocument: "after" }
  );
  await cancelReminder(ctx, doc._id);

  return {
    task: toTask(advanced ?? doc),
    nextOccurrence: next,
    loggedCopyId: inserted.insertedId.toHexString(),
  };
}

/**
 * Un-completing. A finished copy of a repeating task rejoins its series rather
 * than coming back as a twin — a resurrected copy carries no repeat rule, and
 * by tomorrow the morning sweep would be interrogating a daily habit.
 */
export async function uncompleteTask(
  ctx: McpContext,
  scope: Scope,
  doc: WithId<Document>
): Promise<{ task: Task; rejoinedSeries?: string }> {
  const tasks = await tasksCollection();
  const task = toTask(doc);
  const now = new Date();

  if (task.instanceOf) {
    const series = await tasks.findOne({
      _id: new ObjectId(task.instanceOf),
      ...taskScopeFilter(ctx, scope),
    });
    if (series?.repeat) {
      await tasks.deleteOne({ _id: doc._id });
      const restored = await tasks.findOneAndUpdate(
        { _id: series._id },
        {
          $set: {
            plannedFor: task.plannedFor ?? ctx.today,
            status: "planned",
            completedAt: null,
            updatedAt: now,
          },
        },
        { returnDocument: "after" }
      );
      return { task: toTask(restored ?? series), rejoinedSeries: series._id.toHexString() };
    }
  }

  const updated = await tasks.findOneAndUpdate(
    { _id: doc._id },
    {
      $set: {
        status: task.plannedFor ? "planned" : "inbox",
        completedAt: null,
        updatedAt: now,
      },
    },
    { returnDocument: "after" }
  );
  return { task: toTask(updated ?? doc) };
}

/** A reminder belongs to its task; when the task is done or gone, so is it. */
export async function cancelReminder(ctx: McpContext, taskId: ObjectId): Promise<void> {
  const db = await getDb();
  await db
    .collection("scheduled_pushes")
    .deleteMany({ userId: ctx.userId, tag: `remind-${taskId.toHexString()}` });
}

/* ----------------------------------------------------------------- people */

export type Person = { id: string; name: string; email: string; picture?: string };

export async function peopleByIds(ids: ObjectId[]): Promise<Person[]> {
  if (ids.length === 0) return [];
  const db = await getDb();
  const docs = await db
    .collection("users")
    .find({ _id: { $in: ids } })
    .project({ name: 1, email: 1, picture: 1, avatarChoice: 1 })
    .toArray();
  return docs.map((u) => ({
    id: u._id.toHexString(),
    name: String(u.name ?? ""),
    email: String(u.email ?? ""),
    picture: resolveAvatar(
      typeof u.avatarChoice === "string" ? u.avatarChoice : undefined,
      typeof u.picture === "string" ? u.picture : undefined
    ),
  }));
}
