import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { claimInvite, InviteRefused } from "@/lib/city";
import { habitFailure, jsonBody, needToday, todayFrom } from "@/lib/habit-api";

/** Claims a plot a friend saved: you join the city beside them. */
export async function POST(request: Request, ctx: RouteContext<"/api/garden/invites/[code]/claim">) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { code } = await ctx.params;
  const body = await jsonBody(request);
  if (!body) return badRequest("Invalid JSON");
  const today = todayFrom(body.today);
  if (!today) return needToday();
  try {
    return NextResponse.json(await claimInvite(new ObjectId(session.userId), code, { name: body.name, animal: body.animal }, today));
  } catch (err) {
    if (err instanceof InviteRefused) return NextResponse.json({ error: err.message }, { status: 409 });
    return habitFailure(err);
  }
}
