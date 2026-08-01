import { NextResponse } from "next/server";
import { getSessionData, removeAccountSession } from "@/lib/session";
import { originFromRequest } from "@/lib/google";

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
 */
export async function GET(request: Request) {
  const origin = originFromRequest(request);
  const reason = new URL(request.url).searchParams.get("reason") ?? "";

  const data = await getSessionData();
  const active = data?.accounts[data.active];
  const remaining = active ? await removeAccountSession(active.userId) : 0;

  if (remaining > 0) return NextResponse.redirect(`${origin}/today`);
  const q = reason ? `?auth_error=${encodeURIComponent(reason)}` : "";
  return NextResponse.redirect(`${origin}/${q}`);
}
