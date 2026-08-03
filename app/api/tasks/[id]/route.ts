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
  accessibleListIds,
} from "@/lib/tasks";
import { sendToUser } from "@/lib/push";
import { getUserById } from "@/lib/users";
import { sendEmail } from "@/lib/email";
import { taskAssignedEmail } from "@/lib/email-templates";

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

  // Moving a task to a list requires access to THAT list. Owning the task
  // proves nothing about the destination: without this check a task could be
  // planted inside a stranger's list, or smuggled into a private one to keep
  // reading it after a share is revoked.
  if (patch.listId !== undefined && patch.listId !== null) {
    const allowed = await accessibleListIds(userId);
    if (!allowed.some((l) => l.toHexString() === patch.listId)) {
      return badRequest("Unknown list");
    }
  }

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
    // push reaches subscribed devices; email reaches the person. Keyed per
    // task+assignee so a reassignment ping-pong cannot spam anyone.
    void (async () => {
      const assignee = await getUserById(notifyAssignee.toHexString());
      if (!assignee?.email) return;
      const mail = taskAssignedEmail({
        assignerName: session.name,
        taskTitle: String(result.title ?? "A task"),
        listName: where ? where.replace(" \u00b7 in ", "") : "a shared list",
        recipientName: String(assignee.name ?? ""),
      });
      await sendEmail({
        key: `assign:${id}:${notifyAssignee.toHexString()}`,
        to: assignee.email,
        ...mail,
      });
    })().catch((err) => console.error("[email] assignment failed", err));
  }

  return NextResponse.json({ task: toTask(result) });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return badRequest("Invalid task id");

  const userId = new ObjectId(session.userId);
  const tasks = await tasksCollection();
  const task = await tasks.findOne({ _id: new ObjectId(id), ...(await taskAccessFilter(userId)) });
  if (!task) return notFound();

  // Calendar-guest semantics: someone who can see this task ONLY because it
  // was shared with them deletes it from their own world, not from the
  // owner's. Owners and shared-list members delete it for real, as before.
  const isOwner = (task.userId as ObjectId).equals(userId);
  const viaList =
    task.listId != null &&
    (await accessibleListIds(userId)).some((l) => l.equals(task.listId as ObjectId));
  if (!isOwner && !viaList) {
    await tasks.updateOne({ _id: task._id }, { $pull: { memberIds: userId } as never });
    return NextResponse.json({ ok: true, left: true });
  }

  await tasks.deleteOne({ _id: task._id });
  return NextResponse.json({ ok: true });
}
