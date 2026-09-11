import { NextResponse } from "next/server";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { lockOutcomeResponse, relockJournal, unlockJournal } from "@/lib/journal-lock";

/** Opens the journal to this browser for twelve hours, or until it closes. */
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  let body: { pin?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const outcome = await unlockJournal(session.userId, body.pin);
  if (!outcome.ok) return lockOutcomeResponse(outcome);
  return NextResponse.json({ locked: false });
}

/** "Lock now" — closes the journal on this browser without touching the PIN. */
export async function DELETE() {
  const session = await requireSession();
  if (!session) return unauthorized();
  await relockJournal();
  return NextResponse.json({ locked: true });
}
