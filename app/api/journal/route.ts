import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { journalGate } from "@/lib/journal-lock";
import { journalStats, listSummaries, memoriesFor } from "@/lib/journal";
import { isJournalDate, isRealDate, utcTomorrow } from "@/lib/journal-shared";

/** Longest span one request may ask for — a year and a month, for the year view. */
const MAX_SPAN_DAYS = 400;

function daysBetween(a: string, b: string): number {
  return (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000;
}

/**
 * The calendar's view of the journal: one summary per written day in a range.
 * Passing `today` — the browser's own, since the server has no idea where the
 * user is — also returns the totals and the memories for the home page, so
 * opening the journal is one request, not three.
 */
export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const today = url.searchParams.get("today");

  if (!isRealDate(from) || !isRealDate(to) || from > to) {
    return badRequest("from and to must be dates, with from on or before to");
  }
  if (daysBetween(from, to) > MAX_SPAN_DAYS) {
    return badRequest(`A range can span at most ${MAX_SPAN_DAYS} days`);
  }
  if (today !== null && !isJournalDate(today, utcTomorrow())) return badRequest("Invalid today");

  const gate = await journalGate(session.userId);
  if (!gate.ok) return gate.response;

  const userId = new ObjectId(session.userId);
  const [entries, extras] = await Promise.all([
    listSummaries(userId, from, to),
    today ? Promise.all([journalStats(userId, today), memoriesFor(userId, today)]) : Promise.resolve(null),
  ]);

  return NextResponse.json({
    entries,
    ...(extras ? { stats: extras[0], memories: extras[1] } : {}),
  });
}
