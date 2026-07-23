import { NextResponse } from "next/server";
import { getSession, removeAccountSession, destroySession } from "@/lib/session";

/** Signs the ACTIVE account out. If other accounts remain, switches to one. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    await destroySession();
    return NextResponse.redirect(new URL("/", request.url), 303);
  }
  const remaining = await removeAccountSession(session.userId);
  return NextResponse.redirect(new URL(remaining > 0 ? "/today" : "/", request.url), 303);
}
