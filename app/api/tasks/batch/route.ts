import { NextResponse } from "next/server";
import { ObjectId, type AnyBulkWriteOperation } from "mongodb";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import {
  tasksCollection,
  sanitizeTaskPatch,
  buildTaskUpdate,
  taskAccessFilter,
  accessibleListIds,
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
  const allowedLists = new Set((await accessibleListIds(userId)).map((l) => l.toHexString()));
  const ops: AnyBulkWriteOperation[] = [];

  for (const raw of body.updates) {
    if (typeof raw !== "object" || raw === null) return badRequest("Invalid update");
    const { id, ...fields } = raw as Record<string, unknown>;
    if (typeof id !== "string" || !ObjectId.isValid(id)) return badRequest("Invalid task id");
    const patch = sanitizeTaskPatch(fields);
    if (!patch || Object.keys(patch).length === 0) return badRequest("No valid fields in update");
    if (patch.listId !== undefined && patch.listId !== null && !allowedLists.has(patch.listId)) {
      return badRequest("Unknown list");
    }
    ops.push({
      updateOne: {
        filter: { _id: new ObjectId(id), ...access },
        update: buildTaskUpdate(patch),
      },
    });
  }

  const tasks = await tasksCollection();
  await tasks.bulkWrite(ops);
  return NextResponse.json({ ok: true });
}
