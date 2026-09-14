import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest, notFound } from "@/lib/api-auth";
import { waterHabit } from "@/lib/habits";
import { habitFailure, jsonBody, needToday, todayFrom } from "@/lib/habit-api";

/** Waters a plant for today or yesterday: `delta` to add, or `count` to set. */
export async function POST(request: Request, ctx: RouteContext<"/api/habits/[id]/log">) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;
  const body = await jsonBody(request);
  if (!body) return badRequest("Invalid JSON");
  const today = todayFrom(body.today);
  if (!today) return needToday();
  try {
    const result = await waterHabit(new ObjectId(session.userId), id, { date: body.date, delta: body.delta, count: body.count }, today);
    return result ? NextResponse.json(result) : notFound();
  } catch (err) {
    return habitFailure(err);
  }
}
