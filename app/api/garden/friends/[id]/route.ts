import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest, notFound } from "@/lib/api-auth";
import { answerFriendship, endFriendship, FriendRefused } from "@/lib/city";
import { habitFailure, jsonBody } from "@/lib/habit-api";

type Ctx = RouteContext<"/api/garden/friends/[id]">;

/** Answers a friend request: `{ action: "accept" }` or `{ action: "decline" }` (declining is never announced). */
export async function PATCH(request: Request, ctx: Ctx) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;
  const body = await jsonBody(request);
  if (!body) return badRequest("Invalid JSON");
  if (body.action !== "accept" && body.action !== "decline") return badRequest("action is accept or decline");
  try {
    return NextResponse.json({ friendship: await answerFriendship(new ObjectId(session.userId), id, body.action) });
  } catch (err) {
    if (err instanceof FriendRefused) return NextResponse.json({ error: err.message }, { status: 403 });
    return habitFailure(err);
  }
}

/** Takes back a request you sent, or ends a friendship. */
export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;
  return (await endFriendship(new ObjectId(session.userId), id)) ? NextResponse.json({ friendship: null }) : notFound();
}
