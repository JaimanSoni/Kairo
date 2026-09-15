import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest, notFound } from "@/lib/api-auth";
import { archiveHabit, deleteHabitForever, updateHabit } from "@/lib/habits";
import { habitFailure, jsonBody, needToday, todayFrom } from "@/lib/habit-api";
import { refreshGardenLater } from "@/lib/city";

type Ctx = RouteContext<"/api/habits/[id]">;

/** Changes a plant: its name, look, schedule, target or reminder — or retires it to the compost and back. */
export async function PATCH(request: Request, ctx: Ctx) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;
  const body = await jsonBody(request);
  if (!body) return badRequest("Invalid JSON");
  const userId = new ObjectId(session.userId);
  try {
    if ("archived" in body) {
      if (typeof body.archived !== "boolean") return badRequest("archived must be true or false");
      const habit = await archiveHabit(userId, id, body.archived);
      if (habit) refreshGardenLater(userId);
      return habit ? NextResponse.json({ habit }) : notFound();
    }
    const today = todayFrom(body.today);
    if (!today) return needToday();
    const habit = await updateHabit(userId, id, body, today, body.timezone);
    if (habit) refreshGardenLater(userId, today);
    return habit ? NextResponse.json({ habit }) : notFound();
  } catch (err) {
    return habitFailure(err);
  }
}

/** Deletes a composted plant for good, with every day it was watered. A growing plant must be retired first. */
export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;
  const result = await deleteHabitForever(new ObjectId(session.userId), id);
  if (result === "missing") return notFound();
  if (result === "active") return NextResponse.json({ error: "Archive the habit before deleting it." }, { status: 409 });
  refreshGardenLater(new ObjectId(session.userId));
  return NextResponse.json({ ok: true });
}
