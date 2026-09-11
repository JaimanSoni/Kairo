import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { journalGate } from "@/lib/journal-lock";
import { memoriesFor } from "@/lib/journal";
import { isJournalDate, utcTomorrow } from "@/lib/journal-shared";

/**
 * A week ago, a month ago, this day in past years — for a given day. The home
 * page gets these alongside its calendar; this is for any other day.
 */
export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const date = new URL(request.url).searchParams.get("date");
  if (!isJournalDate(date, utcTomorrow())) return badRequest("Invalid date");

  const gate = await journalGate(session.userId);
  if (!gate.ok) return gate.response;

  return NextResponse.json({ memories: await memoriesFor(new ObjectId(session.userId), date) });
}
