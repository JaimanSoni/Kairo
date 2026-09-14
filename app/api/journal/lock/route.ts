import { NextResponse } from "next/server";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import {
  journalLockStatus,
  lockOutcomeResponse,
  removeJournalPin,
  setJournalPin,
} from "@/lib/journal-lock";

/** Whether a PIN is set and whether this browser has entered it. Says nothing else. */
export async function GET() {
  const session = await requireSession({ expired: "allow" });
  if (!session) return unauthorized();
  const status = await journalLockStatus(session.userId);
  if (!status) return unauthorized();
  return NextResponse.json(status);
}

/** Set a PIN, or change one — changing requires the current PIN. */
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  let body: { pin?: unknown; currentPin?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const outcome = await setJournalPin(session.userId, body.pin, body.currentPin);
  if (!outcome.ok) return lockOutcomeResponse(outcome);
  return NextResponse.json({ hasPin: true, locked: false });
}

/** Remove the PIN — requires it. */
export async function DELETE(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  let body: { pin?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const outcome = await removeJournalPin(session.userId, body.pin);
  if (!outcome.ok) return lockOutcomeResponse(outcome);
  return NextResponse.json({ hasPin: false, locked: false });
}
