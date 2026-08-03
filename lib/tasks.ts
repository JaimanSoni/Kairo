import { ObjectId, type Document, type WithId } from "mongodb";
import { getDb, withDbRetry } from "./db";
import { sanitizeRepeat, type Repeat } from "./repeat";
import { resolveAvatar } from "./avatars";
import type { AccountInfo, List, Subtask, Task, TaskStatus } from "./types";

export const TASK_STATUSES: TaskStatus[] = ["inbox", "planned", "done", "someday"];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isDateString(v: unknown): v is string {
  return typeof v === "string" && DATE_RE.test(v);
}

export function isTimeString(v: unknown): v is string {
  return typeof v === "string" && TIME_RE.test(v);
}

/** An ISO instant we'd be willing to store — parseable, and not absurd. */
export function isIsoDateTime(v: unknown): v is string {
  if (typeof v !== "string" || v.length > 40) return false;
  const t = Date.parse(v);
  if (!Number.isFinite(t)) return false;
  // a decade either side of now: enough for clock skew, not enough for junk
  const decade = 10 * 365 * 86_400_000;
  return Math.abs(t - Date.now()) < decade;
}

export function toTask(doc: WithId<Document>): Task {
  return {
    id: doc._id.toHexString(),
    title: String(doc.title ?? ""),
    note: String(doc.note ?? ""),
    status: (doc.status as TaskStatus) ?? "inbox",
    plannedFor: (doc.plannedFor as string) ?? null,
    plannedTime: isTimeString(doc.plannedTime) ? doc.plannedTime : null,
    dueDate: (doc.dueDate as string) ?? null,
    spotlight: Boolean(doc.spotlight),
    listId: doc.listId ? (doc.listId as ObjectId).toHexString() : null,
    estimateMin: typeof doc.estimateMin === "number" ? doc.estimateMin : null,
    order: typeof doc.order === "number" ? doc.order : 0,
    carryCount: typeof doc.carryCount === "number" ? doc.carryCount : 0,
    repeat: doc.repeat ? (sanitizeRepeat(doc.repeat) ?? null) : null,
    startedAt: doc.startedAt ? (doc.startedAt as Date).toISOString() : null,
    reminderAt: typeof doc.reminderAt === "number" ? doc.reminderAt : null,
    assigneeId: doc.assigneeId ? (doc.assigneeId as ObjectId).toHexString() : null,
    instanceOf: doc.instanceOf ? (doc.instanceOf as ObjectId).toHexString() : null,
    ownerId: (doc.userId as ObjectId).toHexString(),
    memberIds: Array.isArray(doc.memberIds)
      ? (doc.memberIds as ObjectId[]).map((m) => m.toHexString())
      : [],
    subtasks: Array.isArray(doc.subtasks) ? (doc.subtasks as Subtask[]) : [],
    completedAt: doc.completedAt ? (doc.completedAt as Date).toISOString() : null,
    createdAt: doc.createdAt ? (doc.createdAt as Date).toISOString() : new Date(0).toISOString(),
  };
}

export function toList(doc: WithId<Document>, viewerIdHex: string): List {
  const memberIds = Array.isArray(doc.memberIds) ? (doc.memberIds as ObjectId[]) : [];
  return {
    id: doc._id.toHexString(),
    name: String(doc.name ?? ""),
    emoji: String(doc.emoji ?? "📁"),
    order: typeof doc.order === "number" ? doc.order : 0,
    locked: Boolean(doc.pinHash),
    role: (doc.userId as ObjectId).toHexString() === viewerIdHex ? "owner" : "member",
    memberCount: memberIds.length,
  };
}

/** Mongo filter matching lists the user can access (owner or member). */
export function listAccessFilter(userId: ObjectId): Document {
  return { $or: [{ userId }, { memberIds: userId }] };
}

/** Ids of all lists the user can access. */
export async function accessibleListIds(userId: ObjectId): Promise<ObjectId[]> {
  const lists = await listsCollection();
  const docs = await lists.find(listAccessFilter(userId)).project({ _id: 1 }).toArray();
  return docs.map((d) => d._id);
}

/** Mongo filter matching tasks the user can access (own, shared with them, or in an accessible list). */
export async function taskAccessFilter(userId: ObjectId): Promise<Document> {
  const listIds = await accessibleListIds(userId);
  return { $or: [{ userId }, { memberIds: userId }, { listId: { $in: listIds } }] };
}

export async function tasksCollection() {
  const db = await getDb();
  return db.collection("tasks");
}

/**
 * Everything the client store needs on boot: live tasks, recent done, lists,
 * and the people directory (everyone on the user's shared lists — needed to
 * render assignees). Retried — a transient Atlas blip must not take down a render.
 */
export async function loadUserData(
  userIdHex: string
): Promise<{ tasks: Task[]; lists: List[]; people: AccountInfo[] }> {
  return withDbRetry(async () => {
    const userId = new ObjectId(userIdHex);
    const db = await getDb();
    const tasks = await tasksCollection();
    const lists = await listsCollection();
    const recentCutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const listDocs = await lists
      .find(listAccessFilter(userId))
      .sort({ order: 1, createdAt: 1 })
      .toArray();

    // Each user keeps their own list order, so reordering never disturbs the
    // people you share a list with. Unranked lists keep their natural order.
    const userDoc = await db
      .collection("users")
      .findOne({ _id: userId }, { projection: { listOrder: 1 } });
    const ranks = new Map<string, number>(
      (Array.isArray(userDoc?.listOrder) ? (userDoc.listOrder as unknown[]) : [])
        .filter((id): id is string => typeof id === "string")
        .map((id, i) => [id, i])
    );
    if (ranks.size > 0) {
      listDocs.sort(
        (a, b) =>
          (ranks.get(a._id.toHexString()) ?? Infinity) -
          (ranks.get(b._id.toHexString()) ?? Infinity)
      );
    }

    const listIds = listDocs.map((d) => d._id);
    const access = { $or: [{ userId }, { memberIds: userId }, { listId: { $in: listIds } }] };

    const [liveTasks, recentDone] = await Promise.all([
      tasks
        .find({ ...access, status: { $in: ["inbox", "planned", "someday"] } })
        .sort({ order: 1, createdAt: 1 })
        .toArray(),
      tasks
        .find({ ...access, status: "done", completedAt: { $gte: recentCutoff } })
        .sort({ completedAt: -1 })
        .toArray(),
    ]);

    // Everyone visible through sharing: shared-list rosters, plus the owner
    // and guests of every directly-shared task. Fetched after the tasks so
    // the roster of a task shared TO this user can be rendered too.
    const peopleIds = new Map<string, ObjectId>();
    for (const l of listDocs) {
      const members = Array.isArray(l.memberIds) ? (l.memberIds as ObjectId[]) : [];
      if (members.length > 0) {
        peopleIds.set((l.userId as ObjectId).toHexString(), l.userId as ObjectId);
        for (const m of members) peopleIds.set(m.toHexString(), m);
      }
    }
    for (const t of [...liveTasks, ...recentDone]) {
      const members = Array.isArray(t.memberIds) ? (t.memberIds as ObjectId[]) : [];
      if (members.length > 0) {
        peopleIds.set((t.userId as ObjectId).toHexString(), t.userId as ObjectId);
        for (const m of members) peopleIds.set(m.toHexString(), m);
      }
    }

    const peopleDocs =
      peopleIds.size > 0
        ? await db
            .collection("users")
            .find({ _id: { $in: [...peopleIds.values()] } })
            .project({ name: 1, email: 1, picture: 1, avatarChoice: 1 })
            .toArray()
        : [];

    return {
      tasks: [...liveTasks, ...recentDone].map(toTask),
      lists: listDocs.map((d) => toList(d, userIdHex)),
      people: peopleDocs.map((u) => ({
        id: u._id.toHexString(),
        name: String(u.name ?? ""),
        email: String(u.email ?? ""),
        picture: resolveAvatar(
          typeof u.avatarChoice === "string" ? u.avatarChoice : undefined,
          typeof u.picture === "string" ? u.picture : undefined
        ),
      })),
    };
  });
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
  plannedTime?: string | null;
  dueDate?: string | null;
  spotlight?: boolean;
  listId?: string | null;
  estimateMin?: number | null;
  order?: number;
  carryCount?: number;
  repeat?: Repeat | null;
  reminderAt?: number | null;
  startedAt?: string | null;
  assigneeId?: string | null;
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
  if ("plannedTime" in body) {
    if (body.plannedTime !== null && !isTimeString(body.plannedTime)) return null;
    patch.plannedTime = body.plannedTime as string | null;
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
  if ("startedAt" in body) {
    if (body.startedAt !== null && !isIsoDateTime(body.startedAt)) return null;
    patch.startedAt = body.startedAt as string | null;
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
  if ("assigneeId" in body) {
    if (body.assigneeId !== null && (typeof body.assigneeId !== "string" || !ObjectId.isValid(body.assigneeId))) {
      return null;
    }
    patch.assigneeId = body.assigneeId as string | null;
  }
  if ("subtasks" in body) {
    if (!Array.isArray(body.subtasks) || body.subtasks.length > 100) return null;
    const subtasks: Subtask[] = [];
    for (const s of body.subtasks) {
      if (typeof s !== "object" || s === null) return null;
      const st = s as Record<string, unknown>;
      if (typeof st.id !== "string" || typeof st.title !== "string" || st.title.length > 500 || typeof st.done !== "boolean") return null;
      const sub: Subtask = { id: st.id, title: st.title, done: st.done };
      if (st.done && "doneAt" in st && st.doneAt !== undefined && st.doneAt !== null) {
        if (!isIsoDateTime(st.doneAt)) return null;
        sub.doneAt = st.doneAt as string;
      }
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
  if (patch.startedAt !== undefined) {
    set.startedAt = patch.startedAt === null ? null : new Date(patch.startedAt);
  }
  if (patch.listId !== undefined) {
    set.listId = patch.listId === null ? null : new ObjectId(patch.listId);
  }
  if (patch.assigneeId !== undefined) {
    set.assigneeId = patch.assigneeId === null ? null : new ObjectId(patch.assigneeId);
  }
  // a time only makes sense on a planned day — drop it when the day is cleared
  if (patch.plannedFor === null) set.plannedTime = null;
  if (patch.status === "done") {
    set.completedAt = new Date();
    set.spotlight = false;
    // finishing ends the work — nothing stays "in progress" once it's done
    set.startedAt = null;
  } else if (patch.status) {
    set.completedAt = null;
  }
  return { $set: set };
}
