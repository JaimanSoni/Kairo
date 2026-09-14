import { NextResponse } from "next/server";
import { ObjectId, type AnyBulkWriteOperation } from "mongodb";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import {
  tasksCollection,
  sanitizeTaskPatch,
  buildTaskUpdate,
  taskAccessFilter,
  openListIds,
  mayMoveTask,
} from "@/lib/tasks";

/** Batch updates — used for reorders and the Fresh Start sweep. */
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  let body: { updates?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  if (!Array.isArray(body.updates) || body.updates.length === 0 || body.updates.length > 200) {
    return badRequest("updates must be a non-empty array (max 200)");
  }

  const userId = new ObjectId(session.userId);
  const access = await taskAccessFilter(userId);
  // destination lists are authorized once for the whole batch — same rule as
  // the single PATCH: owning a task proves nothing about where it may move
  const allowedLists = new Set((await openListIds(userId)).map((l) => l.toHexString()));
  const ops: AnyBulkWriteOperation[] = [];
  const tasks = await tasksCollection();
  // tasks whose list changes: only their owner (or the list's owner) may move them
  const moving = (body.updates as unknown[])
    .filter((u): u is { id: string; listId: unknown } => {
      const r = u as { id?: unknown } | null;
      return typeof r === "object" && r !== null && "listId" in r && typeof r.id === "string" && ObjectId.isValid(r.id);
    })
    .map((u) => new ObjectId(u.id));
  const movable = new Map(
    (moving.length ? await tasks.find({ _id: { $in: moving }, ...access }).toArray() : []).map((d) => [d._id.toHexString(), d])
  );

  for (const raw of body.updates) {
    if (typeof raw !== "object" || raw === null) return badRequest("Invalid update");
    const { id, ...fields } = raw as Record<string, unknown>;
    if (typeof id !== "string" || !ObjectId.isValid(id)) return badRequest("Invalid task id");
    const patch = sanitizeTaskPatch(fields);
    if (!patch || Object.keys(patch).length === 0) return badRequest("No valid fields in update");
    if (patch.listId !== undefined && patch.listId !== null && !allowedLists.has(patch.listId)) {
      return badRequest("Unknown list");
    }
    if (patch.listId !== undefined) {
      const existing = movable.get(id);
      const currentList = existing?.listId ? (existing.listId as ObjectId).toHexString() : null;
      if (existing && patch.listId !== currentList && !(await mayMoveTask(existing, userId))) {
        return NextResponse.json({ error: "Only the task's owner can move it to another list." }, { status: 403 });
      }
    }
    ops.push({
      updateOne: {
        filter: { _id: new ObjectId(id), ...access },
        update: buildTaskUpdate(patch),
      },
    });
  }

  await tasks.bulkWrite(ops);
  return NextResponse.json({ ok: true });
}
