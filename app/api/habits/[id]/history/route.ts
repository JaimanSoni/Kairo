import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest, notFound } from "@/lib/api-auth";
import { habitHistory } from "@/lib/habits";
import { daysBetween, isDateKey } from "@/lib/habits-shared";

/** The days a plant was watered between two dates — up to a year and a bit, for the heatmap. */
export async function GET(request: Request, ctx: RouteContext<"/api/habits/[id]/history">) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;
  const params = new URL(request.url).searchParams;
  const from = params.get("from");
  const to = params.get("to");
  if (!isDateKey(from) || !isDateKey(to) || from > to) return badRequest("from and to must be dates, from first");
  if (daysBetween(from, to) > 400) return badRequest("History is limited to 400 days at a time");
  const logs = await habitHistory(new ObjectId(session.userId), id, from, to);
  return logs ? NextResponse.json({ logs }) : notFound();
}
