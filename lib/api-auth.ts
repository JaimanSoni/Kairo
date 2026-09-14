import { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "./session";
import { isUserDisabled, userGate } from "./users";
import { isAppOpen } from "./lock-grants";
import { accessFor, type UserBilling } from "./billing";

/**
 * The signed-in account for an API route, or null.
 *
 * A valid cookie is not sufficient: it lasts weeks, so a deactivated account
 * would keep working long after being switched off. Callers turn null into a
 * 401, which the client already handles as "signed out" — exactly what should
 * happen here.
 *
 * Two more doors are shut here, for every route at once rather than route by
 * route:
 *
 * - An app lock is a lock, not a curtain. While this browser hasn't entered
 *   the PIN, no route answers — only the unlock itself, which passes
 *   `locked: "allow"`.
 * - Access that has ended ends in the API too, not only on the page. The few
 *   routes a lapsed account must still reach — paying, exporting what's
 *   theirs, switching accounts — pass `expired: "allow"`.
 */
export async function requireSession(opts?: { locked?: "allow"; expired?: "allow" }): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session) return null;
  if (await isUserDisabled(session.userId)) return null;

  const gate = await userGate(session.userId);
  if (!gate || gate.disabled) return null;
  if (opts?.locked !== "allow" && gate.appLockHash && !(await isAppOpen(session.userId, gate.appLockHash))) {
    return null;
  }
  if (opts?.expired !== "allow") {
    const access = await accessFor({ createdAt: gate.createdAt, billing: gate.billing as UserBilling | null });
    if (!access.allowed) return null;
  }
  return session;
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function badRequest(message = "Bad request"): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(): NextResponse {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
