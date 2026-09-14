import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { tasksCollection, toTask, sanitizeTaskPatch, openListIds } from "@/lib/tasks";

/** A real moment in the past, or null: never a date from the future, or before Kairo existed. */
function pastMoment(v: unknown): Date | null {
  if (typeof v !== "string" || v.length > 40) return null;
  const d = new Date(v);
  const t = d.getTime();
  return Number.isFinite(t) && t <= Date.now() && t > Date.UTC(2024, 0, 1) ? d : null;
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const patch = sanitizeTaskPatch(body);
  if (!patch || !patch.title) return badRequest("A task needs a title");

  // a task can only be filed into a list the user can access
  if (patch.listId) {
    const ids = await openListIds(new ObjectId(session.userId));
    if (!ids.some((x) => x.toHexString() === patch.listId)) {
      return badRequest("Unknown list");
    }
  }

  // creation-only: links a done copy back to the repeating series it came
  // from, so un-completing it later can rejoin the series
  let instanceOf: ObjectId | null = null;
  if (typeof body.instanceOf === "string" && ObjectId.isValid(body.instanceOf)) {
    instanceOf = new ObjectId(body.instanceOf);
  }

  const now = new Date();
  const status = patch.status ?? "inbox";
  const doc = {
    userId: new ObjectId(session.userId),
    title: patch.title,
    note: patch.note ?? "",
    status,
    plannedFor: patch.plannedFor ?? null,
    plannedTime: patch.plannedFor ? patch.plannedTime ?? null : null,
    dueDate: patch.dueDate ?? null,
    spotlight: patch.spotlight ?? false,
    listId: patch.listId ? new ObjectId(patch.listId) : null,
    estimateMin: patch.estimateMin ?? null,
    order: patch.order ?? now.getTime(),
    carryCount: 0,
    repeat: patch.repeat ?? null,
    reminderAt: patch.reminderAt ?? null,
    assigneeId: null,
    instanceOf,
    subtasks: patch.subtasks ?? [],
    // completed-instance copies of recurring tasks are created already done;
    // a finished task carried in from guest mode keeps the moment it was done
    completedAt: status === "done" ? pastMoment(body.completedAt) ?? now : null,
    createdAt: now,
    updatedAt: now,
  };

  const tasks = await tasksCollection();
  const result = await tasks.insertOne(doc);
  return NextResponse.json({ task: toTask({ ...doc, _id: result.insertedId }) }, { status: 201 });
}
