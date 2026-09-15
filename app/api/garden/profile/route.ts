import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { getGardener, setGardener } from "@/lib/habits";
import { habitFailure, jsonBody } from "@/lib/habit-api";
import { refreshGardenLater } from "@/lib/city";

/** Your gardener name and animal, and whether you appear on leaderboards. */
export async function GET() {
  const session = await requireSession();
  if (!session) return unauthorized();
  return NextResponse.json({ gardener: await getGardener(new ObjectId(session.userId)) });
}

export async function PUT(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const body = await jsonBody(request);
  if (!body) return badRequest("Invalid JSON");
  try {
    const gardener = await setGardener(new ObjectId(session.userId), body);
    // a garden joining the city arrives with its picture already taken
    refreshGardenLater(new ObjectId(session.userId));
    return NextResponse.json({ gardener });
  } catch (err) {
    return habitFailure(err);
  }
}
