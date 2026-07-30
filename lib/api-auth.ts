import { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "./session";
import { isUserDisabled } from "./users";

/**
 * The signed-in account for an API route, or null.
 *
 * A valid cookie is not sufficient: it lasts weeks, so a deactivated account
 * would keep working long after being switched off. Callers turn null into a
 * 401, which the client already handles as "signed out" — exactly what should
 * happen here.
 */
export async function requireSession(): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session) return null;
  if (await isUserDisabled(session.userId)) return null;
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
