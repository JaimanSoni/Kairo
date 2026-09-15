import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { askFriendship, FriendRefused, friendsOverview } from "@/lib/city";
import { habitFailure, jsonBody, needToday, todayFrom } from "@/lib/habit-api";

/** Your friends in Kairo City, the requests waiting on you and the ones you sent, and a few people you might know. */
export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const today = todayFrom(new URL(request.url).searchParams.get("today"));
  if (!today) return needToday();
  return NextResponse.json(await friendsOverview(new ObjectId(session.userId), today));
}

/** Asks a gardener to be friends, by their garden's address: `{ id }`. Asking someone who asked you first accepts them. */
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const body = await jsonBody(request);
  if (!body) return badRequest("Invalid JSON");
  if (typeof body.id !== "string") return badRequest("id is the garden's address");
  try {
    return NextResponse.json({ friendship: await askFriendship(new ObjectId(session.userId), body.id) });
  } catch (err) {
    if (err instanceof FriendRefused) return NextResponse.json({ error: err.message }, { status: 403 });
    return habitFailure(err);
  }
}
