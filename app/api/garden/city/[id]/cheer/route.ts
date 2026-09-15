import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { cheerGarden, CheerRefused } from "@/lib/city";
import { habitFailure, jsonBody, needToday, todayFrom } from "@/lib/habit-api";

/** A cheer for someone's garden: once a day each, never your own, only once you've joined the city. */
export async function POST(request: Request, ctx: RouteContext<"/api/garden/city/[id]/cheer">) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;
  const body = await jsonBody(request);
  if (!body) return badRequest("Invalid JSON");
  const today = todayFrom(body.today);
  if (!today) return needToday();
  try {
    return NextResponse.json({ cheers: await cheerGarden(new ObjectId(session.userId), id, today) });
  } catch (err) {
    if (err instanceof CheerRefused) return NextResponse.json({ error: err.message }, { status: 403 });
    return habitFailure(err);
  }
}
