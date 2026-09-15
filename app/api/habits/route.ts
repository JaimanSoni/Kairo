import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { loadGarden, plantHabit } from "@/lib/habits";
import { habitFailure, jsonBody, needToday, todayFrom } from "@/lib/habit-api";
import { cheersToday, refreshGardenLater } from "@/lib/city";

/** The whole garden, settled to your today: every plant, the compost, recent days, your gardener name. */
export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const today = todayFrom(new URL(request.url).searchParams.get("today"));
  if (!today) return needToday();
  const userId = new ObjectId(session.userId);
  const [garden, cheers] = await Promise.all([loadGarden(userId, today), cheersToday(userId, today)]);
  // the city's picture of this garden catches up with the day
  refreshGardenLater(userId, today);
  return NextResponse.json({ ...garden, cheers });
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
    refreshGardenLater(new ObjectId(session.userId), today);
    return NextResponse.json({ habit }, { status: 201 });
  } catch (err) {
    return habitFailure(err);
  }
}
