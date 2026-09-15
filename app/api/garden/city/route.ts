import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, badRequest } from "@/lib/api-auth";
import { loadCity } from "@/lib/city";
import { needToday, todayFrom } from "@/lib/habit-api";
import type { CityScope } from "@/lib/habits-shared";

const SCOPES: CityScope[] = ["neighbours", "friends", "top"];

/**
 * A street of Kairo City: `scope=neighbours`, `friends` or `top`. Open to
 * anyone, signed in or not: it only ever holds gardens whose owners chose to
 * join, and someone signed out is shown the top street.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const scope = (params.get("scope") ?? "neighbours") as CityScope;
  if (!SCOPES.includes(scope)) return badRequest("scope is neighbours, friends or top");
  const today = todayFrom(params.get("today"));
  if (!today) return needToday();
  const session = await requireSession();
  return NextResponse.json(await loadCity(session ? new ObjectId(session.userId) : null, scope, today));
}
