import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest, notFound } from "@/lib/api-auth";
import { listsCollection, lockedListIds, tasksCollection, toList } from "@/lib/tasks";

const stillLocked = () => NextResponse.json({ error: "Unlock the list first.", locked: true }, { status: 423 });

export async function PATCH(request: Request, ctx: RouteContext<"/api/lists/[id]">) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return badRequest("Invalid list id");

  let body: { name?: unknown; emoji?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const set: Record<string, unknown> = {};
  if ("name" in body) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 100) {
      return badRequest("Invalid name");
    }
    set.name = body.name.trim();
  }
  if ("emoji" in body) {
    if (typeof body.emoji !== "string" || body.emoji.length > 24) return badRequest("Invalid emoji");
    set.emoji = body.emoji;
  }
  if (Object.keys(set).length === 0) return badRequest("No valid fields");
  if ((await lockedListIds(new ObjectId(session.userId))).some((l) => l.toHexString() === id)) return stillLocked();

  const lists = await listsCollection();
  const result = await lists.findOneAndUpdate(
    { _id: new ObjectId(id), userId: new ObjectId(session.userId) },
    { $set: set },
    { returnDocument: "after" }
  );
  if (!result) return notFound();
  return NextResponse.json({ list: toList(result, session.userId) });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/lists/[id]">) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return badRequest("Invalid list id");

  const userId = new ObjectId(session.userId);
  if ((await lockedListIds(userId)).some((l) => l.toHexString() === id)) return stillLocked();
  const lists = await listsCollection();
  const result = await lists.deleteOne({ _id: new ObjectId(id), userId });
  if (result.deletedCount === 0) return notFound();

  // Tasks in the deleted list fall back to their creators' inboxes.
  const tasks = await tasksCollection();
  await tasks.updateMany({ listId: new ObjectId(id) }, { $set: { listId: null } });

  return NextResponse.json({ ok: true });
}
