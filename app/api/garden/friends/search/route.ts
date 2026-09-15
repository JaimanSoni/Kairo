import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { searchGardeners } from "@/lib/city";
import { needToday, todayFrom } from "@/lib/habit-api";

/**
 * Gardeners on the street, by the name they chose for the city: `?q=`. Only
 * names already shown on the street can be found, never an email or an
 * account that hasn't joined.
 */
export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const params = new URL(request.url).searchParams;
  const today = todayFrom(params.get("today"));
  if (!today) return needToday();
  return NextResponse.json({ results: await searchGardeners(new ObjectId(session.userId), params.get("q"), today) });
}
