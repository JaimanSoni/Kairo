import { NextResponse } from "next/server";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { switchAccountSession } from "@/lib/session";
import { clearAllGrants } from "@/lib/lock-grants";

/**
 * Switches the active account to another signed-in roster account. Works from
 * behind an app lock, and closes everything the account being left had opened:
 * its app lock, its locked lists and its journal. Handing a device over and
 * switching back must mean entering those PINs again.
 */
export async function POST(request: Request) {
  const session = await requireSession({ locked: "allow", expired: "allow" });
  if (!session) return unauthorized();

  let body: { userId?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  if (typeof body.userId !== "string" || !body.userId) return badRequest("userId required");

  const ok = await switchAccountSession(body.userId);
  if (!ok) return badRequest("That account isn't signed in here");
  if (body.userId !== session.userId) await clearAllGrants(session.userId);
  return NextResponse.json({ ok: true });
}
