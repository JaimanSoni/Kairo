import { NextResponse } from "next/server";
import { getSessionData, removeAccountSession } from "@/lib/session";
import { originFromRequest } from "@/lib/google";
import { getUserById } from "@/lib/users";

/**
 * Where a dead session goes to be signed out.
 *
 * A cookie can outlive its account: the account gets deactivated, or deleted
 * and recreated under a new id. The app layout used to bounce those to the
 * landing page, which bounced them straight back because the cookie still
 * existed, a redirect loop with no exit. A server component cannot clear
 * cookies, so it sends them here instead: the dead account leaves the
 * roster, any remaining signed-in account takes over, and only then does a
 * redirect decide where to land.
 *
 * Only a dead account is removed. This is a GET (a server component can only
 * redirect), so any site can send a browser here; for a live account it just
 * goes back to the app instead of signing anyone out.
 */
export async function GET(request: Request) {
  const origin = originFromRequest(request);
  const reason = new URL(request.url).searchParams.get("reason") ?? "";

  const data = await getSessionData();
  const active = data?.accounts[data.active];
  if (!active) return NextResponse.redirect(`${origin}/`);

  const user = await getUserById(active.userId);
  if (user && !user.disabled) return NextResponse.redirect(`${origin}/today`);

  const remaining = await removeAccountSession(active.userId);
  if (remaining > 0) return NextResponse.redirect(`${origin}/today`);
  const q = reason ? `?auth_error=${encodeURIComponent(reason)}` : "";
  return NextResponse.redirect(`${origin}/${q}`);
}
