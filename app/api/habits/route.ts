import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { loadGarden, plantHabit } from "@/lib/habits";
import { habitFailure, jsonBody, needToday, todayFrom } from "@/lib/habit-api";

/** The whole garden, settled to your today: every plant, the compost, recent days, your gardener name. */
export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const today = todayFrom(new URL(request.url).searchParams.get("today"));
  if (!today) return needToday();
  return NextResponse.json(await loadGarden(new ObjectId(session.userId), today));
}

/** Plants a habit — from a seed in the catalogue, or from scratch. */
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const body = await jsonBody(request);
  if (!body) return badRequest("Invalid JSON");
  const today = todayFrom(body.today);
  if (!today) return needToday();
  try {
    const habit = await plantHabit(new ObjectId(session.userId), body, today, body.timezone);
    return NextResponse.json({ habit }, { status: 201 });
  } catch (err) {
    return habitFailure(err);
  }
}
