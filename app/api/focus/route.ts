import { NextResponse } from "next/server";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { clearFocus, getFocus, sanitizeFocus, setFocus } from "@/lib/focus";

/**
 * The account's focus session, the same on every device. Every answer carries
 * the server's `now`, which is the clock the countdown is measured against.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireSession();
  if (!session) return unauthorized();
  return NextResponse.json({ session: await getFocus(session.userId), now: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}

/** Starts a session or changes it: `{ taskId, totalMs, running, remainingMs }`. The server decides when it ends. */
export async function PUT(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const input = sanitizeFocus(body);
  if (!input) return badRequest("A session needs taskId, totalMs, running and remainingMs");
  return NextResponse.json({ session: await setFocus(session.userId, input), now: Date.now() });
}

/** Ends the session, on every device. */
export async function DELETE() {
  const session = await requireSession();
  if (!session) return unauthorized();
  await clearFocus(session.userId);
  return NextResponse.json({ session: null, now: Date.now() });
}
