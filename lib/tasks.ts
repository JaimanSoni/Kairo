import { ObjectId, type Document, type WithId } from "mongodb";
import { getDb } from "./db";
import { sanitizeRepeat, type Repeat } from "./repeat";
import type { List, Subtask, Task, TaskStatus } from "./types";

export const TASK_STATUSES: TaskStatus[] = ["inbox", "planned", "done", "someday"];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateString(v: unknown): v is string {
  return typeof v === "string" && DATE_RE.test(v);
}

export function toTask(doc: WithId<Document>): Task {
  return {
    id: doc._id.toHexString(),
    title: String(doc.title ?? ""),
    note: String(doc.note ?? ""),
    status: (doc.status as TaskStatus) ?? "inbox",
    plannedFor: (doc.plannedFor as string) ?? null,
    dueDate: (doc.dueDate as string) ?? null,
    spotlight: Boolean(doc.spotlight),
    listId: doc.listId ? (doc.listId as ObjectId).toHexString() : null,
    estimateMin: typeof doc.estimateMin === "number" ? doc.estimateMin : null,
    order: typeof doc.order === "number" ? doc.order : 0,
    carryCount: typeof doc.carryCount === "number" ? doc.carryCount : 0,
    repeat: doc.repeat ? (sanitizeRepeat(doc.repeat) ?? null) : null,
    reminderAt: typeof doc.reminderAt === "number" ? doc.reminderAt : null,
    subtasks: Array.isArray(doc.subtasks) ? (doc.subtasks as Subtask[]) : [],
    completedAt: doc.completedAt ? (doc.completedAt as Date).toISOString() : null,
    createdAt: doc.createdAt ? (doc.createdAt as Date).toISOString() : new Date(0).toISOString(),
  };
}

export function toList(doc: WithId<Document>): List {
  return {
    id: doc._id.toHexString(),
    name: String(doc.name ?? ""),
    emoji: String(doc.emoji ?? "📁"),
    order: typeof doc.order === "number" ? doc.order : 0,
    locked: Boolean(doc.pinHash),
  };
}

export async function tasksCollection() {
  const db = await getDb();
  return db.collection("tasks");
}

/** Everything the client store needs on boot: live tasks, recent done, lists. */
export async function loadUserData(userIdHex: string): Promise<{ tasks: Task[]; lists: List[] }> {
  const userId = new ObjectId(userIdHex);
  const tasks = await tasksCollection();
  const lists = await listsCollection();
  const recentCutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const [liveTasks, recentDone, userLists] = await Promise.all([
    tasks
      .find({ userId, status: { $in: ["inbox", "planned", "someday"] } })
      .sort({ order: 1, createdAt: 1 })
      .toArray(),
    tasks
      .find({ userId, status: "done", completedAt: { $gte: recentCutoff } })
      .sort({ completedAt: -1 })
      .toArray(),
    lists.find({ userId }).sort({ order: 1, createdAt: 1 }).toArray(),
  ]);

  return {
    tasks: [...liveTasks, ...recentDone].map(toTask),
    lists: userLists.map(toList),
  };
}

export async function listsCollection() {
  const db = await getDb();
  return db.collection("lists");
}

type TaskPatch = {
  title?: string;
  note?: string;
  status?: TaskStatus;
  plannedFor?: string | null;
  dueDate?: string | null;
  spotlight?: boolean;
  listId?: string | null;
  estimateMin?: number | null;
  order?: number;
  carryCount?: number;
  repeat?: Repeat | null;
  reminderAt?: number | null;
  subtasks?: Subtask[];
};

/** Validates and normalizes a client-sent task patch. Returns null if invalid. */
export function sanitizeTaskPatch(body: Record<string, unknown>): TaskPatch | null {
  const patch: TaskPatch = {};

  if ("title" in body) {
    if (typeof body.title !== "string" || !body.title.trim() || body.title.length > 500) return null;
    patch.title = body.title.trim();
  }
  if ("note" in body) {
    if (typeof body.note !== "string" || body.note.length > 10000) return null;
    patch.note = body.note;
  }
  if ("status" in body) {
    if (!TASK_STATUSES.includes(body.status as TaskStatus)) return null;
    patch.status = body.status as TaskStatus;
  }
  if ("plannedFor" in body) {
    if (body.plannedFor !== null && !isDateString(body.plannedFor)) return null;
    patch.plannedFor = body.plannedFor as string | null;
  }
  if ("dueDate" in body) {
    if (body.dueDate !== null && !isDateString(body.dueDate)) return null;
    patch.dueDate = body.dueDate as string | null;
  }
  if ("spotlight" in body) {
    if (typeof body.spotlight !== "boolean") return null;
    patch.spotlight = body.spotlight;
  }
  if ("listId" in body) {
    if (body.listId !== null && (typeof body.listId !== "string" || !ObjectId.isValid(body.listId))) return null;
    patch.listId = body.listId as string | null;
  }
  if ("estimateMin" in body) {
    if (body.estimateMin !== null && (typeof body.estimateMin !== "number" || body.estimateMin < 0 || body.estimateMin > 24 * 60)) return null;
    patch.estimateMin = body.estimateMin as number | null;
  }
  if ("order" in body) {
    if (typeof body.order !== "number" || !Number.isFinite(body.order)) return null;
    patch.order = body.order;
  }
  if ("carryCount" in body) {
    if (typeof body.carryCount !== "number" || body.carryCount < 0 || body.carryCount > 10000) return null;
    patch.carryCount = body.carryCount;
  }
  if ("repeat" in body) {
    const repeat = sanitizeRepeat(body.repeat);
    if (repeat === undefined) return null;
    patch.repeat = repeat;
  }
  if ("reminderAt" in body) {
    if (body.reminderAt !== null) {
      const yearAhead = Date.now() + 366 * 24 * 60 * 60 * 1000;
      if (
        typeof body.reminderAt !== "number" ||
        !Number.isFinite(body.reminderAt) ||
        body.reminderAt > yearAhead
      )
        return null;
    }
    patch.reminderAt = body.reminderAt as number | null;
  }
  if ("subtasks" in body) {
    if (!Array.isArray(body.subtasks) || body.subtasks.length > 100) return null;
    const subtasks: Subtask[] = [];
    for (const s of body.subtasks) {
      if (typeof s !== "object" || s === null) return null;
      const st = s as Record<string, unknown>;
      if (typeof st.id !== "string" || typeof st.title !== "string" || st.title.length > 500 || typeof st.done !== "boolean") return null;
      const sub: Subtask = { id: st.id, title: st.title, done: st.done };
      if ("plannedFor" in st && st.plannedFor !== undefined) {
        if (st.plannedFor !== null && !isDateString(st.plannedFor)) return null;
        sub.plannedFor = st.plannedFor as string | null;
      }
      subtasks.push(sub);
    }
    patch.subtasks = subtasks;
  }

  return patch;
}

/** Builds the Mongo $set/$unset update from a sanitized patch, handling done transitions. */
export function buildTaskUpdate(patch: TaskPatch): Document {
  const set: Document = { ...patch, updatedAt: new Date() };
  if (patch.listId !== undefined) {
    set.listId = patch.listId === null ? null : new ObjectId(patch.listId);
  }
  if (patch.status === "done") {
    set.completedAt = new Date();
    set.spotlight = false;
  } else if (patch.status) {
    set.completedAt = null;
  }
  return { $set: set };
}
