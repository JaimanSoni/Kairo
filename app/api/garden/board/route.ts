import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { leaderboard } from "@/lib/habits";
import { habitFailure, needToday, todayFrom } from "@/lib/habit-api";

/** A seed's leaderboard: `scope=global` or `scope=friends`. */
export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const params = new URL(request.url).searchParams;
  const seed = params.get("seed") ?? "";
  const scope = params.get("scope") ?? "global";
  if (scope !== "global" && scope !== "friends") return badRequest("scope is global or friends");
  const today = todayFrom(params.get("today"));
  if (!today) return needToday();
  try {
    return NextResponse.json(await leaderboard(new ObjectId(session.userId), seed, scope, today));
  } catch (err) {
    return habitFailure(err);
  }
}
