import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { journalGate } from "@/lib/journal-lock";
import { searchEntries } from "@/lib/journal";

/** Pages containing a word or phrase, newest first, each with the passage it was found in. */
export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ results: [] });
  if (q.length > 100) return badRequest("Search for something shorter");

  const gate = await journalGate(session.userId);
  if (!gate.ok) return gate.response;

  return NextResponse.json({ results: await searchEntries(new ObjectId(session.userId), q) });
}
