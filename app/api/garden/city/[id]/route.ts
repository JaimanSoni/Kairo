import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, notFound } from "@/lib/api-auth";
import { visitGarden } from "@/lib/city";
import { needToday, todayFrom } from "@/lib/habit-api";

/** One garden of the city, to walk into: a joined garden, or your own (`me`). */
export async function GET(request: Request, ctx: RouteContext<"/api/garden/city/[id]">) {
  const { id } = await ctx.params;
  const today = todayFrom(new URL(request.url).searchParams.get("today"));
  if (!today) return needToday();
  const session = await requireSession();
  const garden = await visitGarden(session ? new ObjectId(session.userId) : null, id, today);
  return garden ? NextResponse.json({ garden }) : notFound();
}
