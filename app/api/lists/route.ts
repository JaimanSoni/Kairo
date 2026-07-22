import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { listsCollection, toList } from "@/lib/tasks";

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  let body: { name?: unknown; emoji?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 100) {
    return badRequest("A list needs a name");
  }
  // accepts an emoji or a 3D-icon key like "list-home"
  const emoji = typeof body.emoji === "string" && body.emoji.length <= 24 ? body.emoji : "list-folder";

  const now = new Date();
  const doc = {
    userId: new ObjectId(session.userId),
    name: body.name.trim(),
    emoji,
    order: now.getTime(),
    createdAt: now,
  };
  const lists = await listsCollection();
  const result = await lists.insertOne(doc);
  return NextResponse.json({ list: toList({ ...doc, _id: result.insertedId }) }, { status: 201 });
}
