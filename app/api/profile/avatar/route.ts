import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { isAvatarChoice } from "@/lib/avatars";

/** Sets which face this account wears: the Google photo, or a house animal. */
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  let body: { choice?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  if (!isAvatarChoice(body.choice)) return badRequest("Unknown avatar choice");

  const db = await getDb();
  await db.collection("users").updateOne(
    { _id: new ObjectId(session.userId) },
    body.choice === "google"
      ? { $unset: { avatarChoice: "" } }
      : { $set: { avatarChoice: body.choice } }
  );
  return NextResponse.json({ ok: true });
}
