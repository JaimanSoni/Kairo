import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest, notFound } from "@/lib/api-auth";
import { tasksCollection, toTask, sanitizeTaskPatch, buildTaskUpdate, taskAccessFilter } from "@/lib/tasks";

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

  const tasks = await tasksCollection();
  const result = await tasks.findOneAndUpdate(
    { _id: new ObjectId(id), ...(await taskAccessFilter(new ObjectId(session.userId))) },
    buildTaskUpdate(patch),
    { returnDocument: "after" }
  );
  if (!result) return notFound();
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
