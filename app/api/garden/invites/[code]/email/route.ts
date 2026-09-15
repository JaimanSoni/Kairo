import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { emailInvite, InviteRefused, InviteSendFailed } from "@/lib/city";
import { habitFailure, jsonBody, needToday, todayFrom } from "@/lib/habit-api";

/** Sends one of your saved plots to a friend by email. */
export async function POST(request: Request, ctx: RouteContext<"/api/garden/invites/[code]/email">) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { code } = await ctx.params;
  const body = await jsonBody(request);
  if (!body) return badRequest("Invalid JSON");
  const today = todayFrom(body.today);
  if (!today) return needToday();
  try {
    return NextResponse.json(await emailInvite(new ObjectId(session.userId), code, body.email, today));
  } catch (err) {
    if (err instanceof InviteRefused) return NextResponse.json({ error: err.message }, { status: 409 });
    if (err instanceof InviteSendFailed) return NextResponse.json({ error: err.message }, { status: 502 });
    return habitFailure(err);
  }
}
