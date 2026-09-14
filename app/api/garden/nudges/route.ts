import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { setGardenNudges } from "@/lib/habits";
import { jsonBody } from "@/lib/habit-api";

/** Turns the evening "a streak is about to break" nudge on or off. */
export async function PUT(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const body = await jsonBody(request);
  if (!body || typeof body.on !== "boolean") return badRequest("on must be true or false");
  return NextResponse.json({ on: await setGardenNudges(new ObjectId(session.userId), body.on, body.timezone) });
}
