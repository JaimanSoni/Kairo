import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest, notFound } from "@/lib/api-auth";
import {
  tasksCollection,
  listsCollection,
  toTask,
  sanitizeTaskPatch,
  buildTaskUpdate,
  taskAccessFilter,
} from "@/lib/tasks";
import { sendToUser } from "@/lib/push";

export async function PATCH(request: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return badRequest("Invalid task id");

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const patch = sanitizeTaskPatch(body);
  if (!patch || Object.keys(patch).length === 0) return badRequest("No valid fields");

  const userId = new ObjectId(session.userId);
  const tasks = await tasksCollection();
  const existing = await tasks.findOne({ _id: new ObjectId(id), ...(await taskAccessFilter(userId)) });
  if (!existing) return notFound();

  // Assigning is only valid to a member of the task's shared list.
  let notifyAssignee: ObjectId | null = null;
  if (patch.assigneeId !== undefined && patch.assigneeId !== null) {
    const effectiveListId =
      patch.listId !== undefined
        ? patch.listId
          ? new ObjectId(patch.listId)
          : null
        : (existing.listId as ObjectId | null) ?? null;
    if (!effectiveListId) return badRequest("Assign only works inside a shared list");

    const lists = await listsCollection();
    const list = await lists.findOne({ _id: effectiveListId });
    if (!list) return badRequest("Unknown list");

    const memberSet = new Set<string>([
      (list.userId as ObjectId).toHexString(),
      ...((Array.isArray(list.memberIds) ? (list.memberIds as ObjectId[]) : []).map((m) => m.toHexString())),
    ]);
    if (!memberSet.has(userId.toHexString())) return unauthorized();
    if (!memberSet.has(patch.assigneeId)) return badRequest("That person isn't on this list");

    const prevAssignee = existing.assigneeId ? (existing.assigneeId as ObjectId).toHexString() : null;
    if (patch.assigneeId !== prevAssignee && patch.assigneeId !== userId.toHexString()) {
      notifyAssignee = new ObjectId(patch.assigneeId);
    }
  }

  const result = await tasks.findOneAndUpdate(
    { _id: new ObjectId(id), ...(await taskAccessFilter(userId)) },
    buildTaskUpdate(patch),
    { returnDocument: "after" }
  );
  if (!result) return notFound();

  if (notifyAssignee) {
    // the list names where the task landed; skipped rather than failed if gone
    let where = "";
    if (result.listId) {
      const list = await (await listsCollection()).findOne(
        { _id: result.listId as ObjectId },
        { projection: { name: 1 } }
      );
      if (list?.name) where = ` · in ${String(list.name)}`;
    }
    void sendToUser(notifyAssignee, {
      title: `${session.name} sent this your way`,
      body: `${String(result.title ?? "A task")}${where}`,
      tag: `assign-${id}`,
      url: "/today",
    });
  }

  return NextResponse.json({ task: toTask(result) });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return badRequest("Invalid task id");

  const tasks = await tasksCollection();
  const result = await tasks.deleteOne({
    _id: new ObjectId(id),
    ...(await taskAccessFilter(new ObjectId(session.userId))),
  });
  if (result.deletedCount === 0) return notFound();
  return NextResponse.json({ ok: true });
}
