import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, notFound } from "@/lib/api-auth";
import { cancelInvite, inviteInfo } from "@/lib/city";
import { needToday, todayFrom } from "@/lib/habit-api";

type Ctx = RouteContext<"/api/garden/invites/[code]">;

/** What a saved plot's link holds: whose garden it's beside, and whether it's still free. Open to anyone with the link. */
export async function GET(request: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  const today = todayFrom(new URL(request.url).searchParams.get("today"));
  if (!today) return needToday();
  const session = await requireSession();
  const info = await inviteInfo(session ? new ObjectId(session.userId) : null, code, today);
  return info ? NextResponse.json(info) : notFound();
}

/** Lets a saved plot go, while nobody has claimed it. */
export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { code } = await ctx.params;
  return (await cancelInvite(new ObjectId(session.userId), code)) ? NextResponse.json({ ok: true }) : notFound();
}
