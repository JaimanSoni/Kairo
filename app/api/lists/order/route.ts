import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { accessibleListIds } from "@/lib/tasks";
import { getDb } from "@/lib/db";

/**
 * Saves this user's preferred list order. Stored on the user, not the lists,
 * so each person orders their own sidebar without affecting anyone they
 * share a list with.
 */
export async function PUT(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  let body: { ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  if (!Array.isArray(body.ids) || body.ids.length > 200) {
    return badRequest("ids must be an array (max 200)");
  }
  const ids = body.ids;
  if (!ids.every((id) => typeof id === "string" && ObjectId.isValid(id))) {
    return badRequest("Invalid list id");
  }

  // silently drop anything the user can no longer reach
  const userId = new ObjectId(session.userId);
  const allowed = new Set((await accessibleListIds(userId)).map((x) => x.toHexString()));
  const order = [...new Set(ids as string[])].filter((id) => allowed.has(id));

  const db = await getDb();
  await db.collection("users").updateOne({ _id: userId }, { $set: { listOrder: order } });

  return NextResponse.json({ ok: true, order });
}
